"""Edge-case tests for vote casting (specs/03 section 4)."""
import concurrent.futures

from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APIClient, APITestCase, APITransactionTestCase

from apps.polls.models import Poll, PollOption, Vote

VOTES_URL = "/api/v1/polls/{pk}/votes/"
VOTE_ALIAS_URL = "/api/v1/polls/{pk}/vote/"


def make_poll(**overrides):
    now = timezone.now()
    params = {
        "title": "Favorite framework?",
        "status": "open",
        "created_by": "tests",
    }
    params.update(overrides)
    poll = Poll.objects.create(**params)
    PollOption.objects.create(poll=poll, label="React", position=1)
    PollOption.objects.create(poll=poll, label="Vue", position=2)
    return poll


def vote_body(poll):
    return {"optionId": poll.options.first().pk}


def post_json(client, url, body, headers=None):
    """POST as application/json (DRF test client defaults to multipart)."""
    return client.post(
        url,
        body,
        content_type="application/json",
        headers=headers or {},
    )


class ThrottleFreeClientMixin:
    """Swap throttle rates for huge limits so vote-heavy tests never 429."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # DRF snapshots THROTTLE_RATES at class-definition time, so patch the
        # throttle classes directly and clear the shared throttle cache.
        from django.core.cache import cache
        from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle

        rates = {
            "anon": "100000/min",
            "vote": "100000/min",
            "results": "100000/min",
            "telemetry": "100000/min",
        }
        AnonRateThrottle.THROTTLE_RATES = rates
        ScopedRateThrottle.THROTTLE_RATES = rates
        cache.clear()
        cls._orig_throttle_rates = (
            (AnonRateThrottle, AnonRateThrottle.THROTTLE_RATES),
            (ScopedRateThrottle, ScopedRateThrottle.THROTTLE_RATES),
        )

    @classmethod
    def tearDownClass(cls):
        from django.core.cache import cache

        cache.clear()
        super().tearDownClass()


class VoteCastingTests(ThrottleFreeClientMixin, APITestCase):
    def setUp(self):
        self.poll = make_poll()

    def test_vote_success_returns_201_vote_dto(self):
        response = post_json(self.client, VOTES_URL.format(pk=self.poll.pk), vote_body(self.poll))
        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertEqual(payload["data"]["pollId"], self.poll.pk)
        self.assertEqual(payload["data"]["optionId"], self.poll.options.first().pk)
        self.assertEqual(Vote.objects.filter(poll=self.poll).count(), 1)

    def test_vote_alias_path_works(self):
        response = post_json(self.client, VOTE_ALIAS_URL.format(pk=self.poll.pk), vote_body(self.poll))
        self.assertEqual(response.status_code, 201)

    def test_double_vote_is_409_vote_duplicate(self):
        first = post_json(self.client, VOTES_URL.format(pk=self.poll.pk), vote_body(self.poll))
        self.assertEqual(first.status_code, 201)
        second = post_json(self.client, VOTES_URL.format(pk=self.poll.pk), vote_body(self.poll))
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.json()["error"]["code"], "VOTE_DUPLICATE")
        self.assertEqual(Vote.objects.filter(poll=self.poll).count(), 1)

    def test_closed_poll_is_409_poll_not_open(self):
        poll = make_poll(title="Closed one", status="closed")
        response = post_json(self.client, VOTES_URL.format(pk=poll.pk), vote_body(poll))
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "POLL_NOT_OPEN")

    def test_expired_poll_is_409_poll_expired(self):
        now = timezone.now()
        poll = make_poll(
            title="Expired one",
            status="open",
            opens_at=now - timedelta(days=2),
            closes_at=now - timedelta(hours=1),
        )
        response = post_json(self.client, VOTES_URL.format(pk=poll.pk), vote_body(poll))
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "POLL_EXPIRED")

    def test_option_mismatch_is_400(self):
        other = make_poll(title="Other poll")
        response = post_json(
            self.client,
            VOTES_URL.format(pk=self.poll.pk),
            {"optionId": other.options.last().pk},
        )
        self.assertEqual(response.status_code, 400)

    def test_idempotency_key_replay_returns_cached_201(self):
        headers = {"Idempotency-Key": "11111111-1111-4111-8111-111111111111"}
        first = post_json(
            self.client, VOTES_URL.format(pk=self.poll.pk), vote_body(self.poll), headers
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.headers.get("Idempotency-Replayed"), "false")
        second = post_json(
            self.client, VOTES_URL.format(pk=self.poll.pk), vote_body(self.poll), headers
        )
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second.headers.get("Idempotency-Replayed"), "true")
        self.assertEqual(Vote.objects.filter(poll=self.poll).count(), 1)

    def test_draft_poll_is_404_for_anonymous(self):
        poll = make_poll(title="Hidden draft", status="draft")
        detail = self.client.get(f"/api/v1/polls/{poll.pk}/")
        self.assertEqual(detail.status_code, 404)

    def test_allow_revote_updates_existing_vote(self):
        poll = make_poll(title="Revote allowed", allow_revote=True)
        first_option = poll.options.first()
        second_option = poll.options.last()
        first = post_json(self.client, VOTES_URL.format(pk=poll.pk), {"optionId": first_option.pk})
        self.assertEqual(first.status_code, 201)
        second = post_json(self.client, VOTES_URL.format(pk=poll.pk), {"optionId": second_option.pk})
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second.json()["data"]["optionId"], second_option.pk)
        votes = Vote.objects.filter(poll=poll)
        self.assertEqual(votes.count(), 1)
        self.assertEqual(votes.first().option_id, second_option.pk)


class ConcurrentVoteRaceTests(ThrottleFreeClientMixin, APITransactionTestCase):
    """Same-IP race: poll row lock + UNIQUE constraint -> exactly one 201."""

    def test_concurrent_same_ip_votes_exactly_one_201(self):
        poll = make_poll(title="Race poll")
        url = VOTES_URL.format(pk=poll.pk)
        body = vote_body(poll)

        def fire(_):
            from django.db import connection

            client = APIClient()
            try:
                response = post_json(client, url, body)
                return response.status_code
            finally:
                connection.close()

        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            codes = list(pool.map(fire, range(4)))

        self.assertEqual(codes.count(201), 1)
        self.assertEqual(codes.count(409), 3)
        self.assertEqual(Vote.objects.filter(poll=poll).count(), 1)

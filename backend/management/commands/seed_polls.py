"""Seed 4 polls per spec section 3, idempotent upsert by title."""
import os
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.polls.models import Poll, PollOption, Vote


def seed_hash(poll_key: str, option_label: str, index: int) -> str:
    """Deterministic synthetic voter hash using SEED_VOTE_SALT (never VOTE_HASH_SALT)."""
    import hashlib

    salt = os.environ.get(
        "SEED_VOTE_SALT", "dev_deterministic_seed_salt_for_fixtures"
    )
    raw = f"{poll_key}:{option_label}:voter-{index}"
    return hashlib.sha256(f"{raw}{salt}".encode("utf-8")).hexdigest()


POLLS = [
    {
        "key": "favorite-frontend-framework",
        "title": "Favorite frontend framework?",
        "description": "Tell us which frontend framework you reach for first.",
        "status": "open",
        "options": ["React", "Vue", "Svelte", "Angular"],
        "vote_counts": [18, 10, 8, 4],
    },
    {
        "key": "tabs-or-spaces",
        "title": "Tabs or spaces?",
        "description": "The eternal debate, settled once and for all (maybe).",
        "status": "open",
        "options": ["Tabs", "Spaces"],
        "vote_counts": [11, 12],
    },
    {
        "key": "next-community-event",
        "title": "What should the next community event be?",
        "description": "Draft poll: not open for voting yet.",
        "status": "draft",
        "options": ["Hackathon", "Lightning talks", "Q&A panel"],
        "vote_counts": [0, 0, 0],
    },
    {
        "key": "best-api-style",
        "title": "Best API style for small teams?",
        "description": "Closed poll kept for historical results.",
        "status": "closed",
        "options": ["REST", "GraphQL", "gRPC", "RPC over HTTP"],
        "vote_counts": [55, 35, 20, 10],
        "closes_in_days": -7,
        "opens_in_days": -21,
    },
]


class Command(BaseCommand):
    help = "Seed polls and synthetic votes (idempotent upsert by title; --force to reseed)."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Reseed existing polls.")

    def handle(self, *args, **options):
        force = options["force"]
        try:
            with transaction.atomic():
                total_votes = 0
                for spec in POLLS:
                    poll, created = Poll.objects.get_or_create(
                        title=spec["title"],
                        defaults={
                            "description": spec["description"],
                            "status": spec["status"],
                            "is_anonymous": True,
                            "allow_revote": False,
                            "created_by": "seed",
                        },
                    )
                    if created or force:
                        poll.description = spec["description"]
                        poll.status = spec["status"]
                        poll.created_by = "seed"
                        if spec.get("opens_in_days"):
                            poll.opens_at = timezone.now() + timedelta(
                                days=spec["opens_in_days"]
                            )
                        if spec.get("closes_in_days"):
                            poll.closes_at = timezone.now() + timedelta(
                                days=spec["closes_in_days"]
                            )
                        poll.save()

                    options = []
                    for position, label in enumerate(spec["options"]):
                        option, _ = PollOption.objects.update_or_create(
                            poll=poll,
                            label=label,
                            defaults={"position": position},
                        )
                        options.append(option)

                    # Idempotent vote seeding: only add missing synthetic votes.
                    existing = set(
                        Vote.objects.filter(poll=poll).values_list("voter_ip", flat=True)
                    )
                    new_votes = []
                    for option, count in zip(options, spec["vote_counts"]):
                        for index in range(count):
                            voter_ip = seed_hash(spec["key"], option.label, index)
                            if voter_ip in existing:
                                continue
                            existing.add(voter_ip)
                            new_votes.append(
                                Vote(
                                    poll=poll,
                                    option=option,
                                    voter_ip=voter_ip,
                                )
                            )
                    Vote.objects.bulk_create(new_votes)
                    total_votes += len(new_votes)
                    self.stdout.write(
                        f"{('created' if created else 'updated')}: {poll.title} "
                        f"(+{len(new_votes)} votes)"
                    )
            self.stdout.write(self.style.SUCCESS(f"Seeding complete ({total_votes} new votes)."))
        except IntegrityError as exc:
            raise CommandError(f"Seed failed loudly on constraint violation: {exc}")

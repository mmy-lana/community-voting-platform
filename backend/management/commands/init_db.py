from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Initialize the database: run migrations programmatically."

    def handle(self, *args, **options):
        self.stdout.write("Running migrations...")
        call_command("migrate", interactive=False, verbosity=1)
        self.stdout.write(self.style.SUCCESS("Database initialized."))

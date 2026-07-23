"""CLI entrypoint:  python cli.py --config sources.yaml"""
from __future__ import annotations

import argparse

from pipeline import run_sync


def main() -> None:
    p = argparse.ArgumentParser(description="Fetch fresh job listings from ATS APIs.")
    p.add_argument("-c", "--config", default="sources.yaml")
    p.add_argument("--dry-run", action="store_true",
                   help="show matches without updating dedup state or notifying")
    args = p.parse_args()
    run_sync(args.config, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
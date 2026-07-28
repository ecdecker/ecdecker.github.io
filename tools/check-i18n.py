#!/usr/bin/env python3
"""Fail the build when a language is missing a translatable key.

Why this exists: Hugo does not report an untranslated string. A missing
i18n key silently falls back to the default language, and a key absent
from params.<lang>.toml renders as nothing at all -- `{{ with $f.hint }}`
simply swallows it. Both failures look like a clean build, which is how
the homepage came to render 70% English under a French URL.

What is checked
---------------
Key *parity* against the default language, in the three places a
translatable string can live:

    themes/folio/i18n/<lang>.toml       template strings
    config/_default/params.<lang>.toml  site-wide chrome
    content/_index.<lang>.md            homepage copy (front matter)
    config/_default/menus.<lang>.toml   navigation labels

Nested maps and arrays are flattened to paths, so a language that drops
`meta` from one entry of `principles` is caught:

    folio.principles[1].meta

That is the exact failure mode Hugo's config merge creates. Arrays are
replaced wholesale rather than merged element-wise, so an array entry
written with only some of its keys loses the rest silently.

What is NOT checked
-------------------
Whether every page exists in every language. Partial article coverage is
intended here: a post is written in the languages someone chose to write
it in, and the language selector already shows only the languages a given
page actually exists in. Flagging those would be noise that trains people
to ignore the check.

Usage
-----
    tools/check-i18n.py              # exits 1 on any missing key
    tools/check-i18n.py --quiet      # only print problems

Pair it with Hugo's own check, which catches T "..." calls whose key is
absent rather than merely untranslated:

    hugo --printI18nWarnings --panicOnWarning

Pin the Hugo version when you do -- --panicOnWarning fails on any warning,
including future deprecation notices.
"""

import argparse
import os
import sys
import tomllib

import yaml

CONFIG_DIR = "config/_default"
I18N_DIR = "themes/folio/i18n"
HOME_CONTENT = "content"

# Keys that legitimately differ per language rather than being translated,
# or that Hugo supplies itself. Compared for presence, never for parity.
IGNORED_PATHS = {
    "title",  # front matter: the same word in every language here
}


# --------------------------------------------------------------------------
# Flattening
# --------------------------------------------------------------------------

def flatten(value, prefix=""):
    """Map a nested config/front-matter structure to a set of key paths.

    Scalars terminate a path. Arrays index into it, because Hugo replaces
    arrays wholesale -- entry 1 losing a key is a real defect, not a
    stylistic difference.
    """
    paths = set()
    if isinstance(value, dict):
        for k, v in value.items():
            paths |= flatten(v, f"{prefix}.{k}" if prefix else k)
    elif isinstance(value, list):
        for i, v in enumerate(value):
            paths |= flatten(v, f"{prefix}[{i}]")
    else:
        if prefix:
            paths.add(prefix)
    return paths


def read_toml(path):
    if not os.path.exists(path):
        return None
    with open(path, "rb") as fh:
        return tomllib.load(fh)


def read_front_matter(path):
    """Pull the YAML front matter out of a Markdown file."""
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    return yaml.safe_load(text[3:end]) or {}


# --------------------------------------------------------------------------
# Site facts
# --------------------------------------------------------------------------

def languages():
    """Return (default_lang, [langs...]) ordered by configured weight."""
    langs = read_toml(os.path.join(CONFIG_DIR, "languages.toml")) or {}
    site = read_toml(os.path.join(CONFIG_DIR, "hugo.toml")) or {}
    default = site.get("defaultContentLanguage", "en")
    ordered = sorted(langs, key=lambda l: langs[l].get("weight", 99))
    return default, ordered


# --------------------------------------------------------------------------
# Checks
# --------------------------------------------------------------------------

def compare(label, reference, default_lang, others, problems):
    """Report paths present in the default language but missing elsewhere."""
    ref = flatten(reference) - IGNORED_PATHS
    print(f"\n== {label} ==")
    print(f"  {default_lang:<4} {len(ref)} keys (reference)")

    for lang, data in others:
        if data is None:
            print(f"  {lang:<4} FILE MISSING")
            problems.append(f"{label}: no file for {lang}")
            continue
        have = flatten(data) - IGNORED_PATHS
        missing = sorted(ref - have)
        extra = sorted(have - ref)
        if not missing and not extra:
            print(f"  {lang:<4} OK ({len(have)} keys)")
            continue
        print(f"  {lang:<4} {len(have)} keys")
        for path in missing:
            print(f"         MISSING  {path}")
            problems.append(f"{label}: {lang} missing {path}")
        for path in extra:
            # Not a failure: a language may carry a key the default lacks.
            print(f"         extra    {path}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--quiet", action="store_true",
                    help="print problems only")
    args = ap.parse_args()

    if not os.path.isdir(CONFIG_DIR):
        sys.exit(f"run from the site root: {CONFIG_DIR} not found")

    default, langs = languages()
    others = [l for l in langs if l != default]
    problems = []

    if not args.quiet:
        print(f"languages: {langs}  (default: {default})")

    compare(
        "template strings (i18n)",
        read_toml(f"{I18N_DIR}/{default}.toml") or {},
        default,
        [(l, read_toml(f"{I18N_DIR}/{l}.toml")) for l in others],
        problems,
    )
    compare(
        "site params",
        read_toml(f"{CONFIG_DIR}/params.{default}.toml") or {},
        default,
        [(l, read_toml(f"{CONFIG_DIR}/params.{l}.toml")) for l in others],
        problems,
    )
    compare(
        "menus",
        read_toml(f"{CONFIG_DIR}/menus.{default}.toml") or {},
        default,
        [(l, read_toml(f"{CONFIG_DIR}/menus.{l}.toml")) for l in others],
        problems,
    )
    compare(
        "homepage front matter",
        read_front_matter(f"{HOME_CONTENT}/_index.md") or {},
        default,
        [(l, read_front_matter(f"{HOME_CONTENT}/_index.{l}.md")) for l in others],
        problems,
    )

    print()
    if problems:
        print(f"RESULT: {len(problems)} missing translation(s)")
        return 1
    print("RESULT: all languages complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())

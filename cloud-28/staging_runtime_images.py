"""Staging-only export of direct ESPN IMG URL helpers.

The locked original runtime_*.js modules are preserved byte-for-byte at root.
Only cloned /staging/runtime/ scripts receive one narrowly scoped transport
replacement; original board markup/CSS/timing/data parsers are not edited.
"""
import re
from pathlib import Path

ORIGINAL_HELPER = (
    b"  const imageURL = value => {\n"
    b"    try { return IMAGE_HOSTS.has(new URL(value,location.href).hostname) ? origin+'/proxy?url='+encodeURIComponent(value) : value; }\n"
    b"    catch (_) { return value || ''; }\n"
    b"  };"
)

# imageURL() is called by the approved setImageNode(...), not fetch().
# Only public ESPN image paths are direct. Everything else uses its old proxy.
STAGING_HELPER = (
    b"  const imageURL = value => {\n"
    b"    try {\n"
    b"      const target=new URL(value,location.href);\n"
    b"      if(target.protocol==='https:' && target.hostname==='a.espncdn.com' &&\n"
    b"         !target.port && !target.username && !target.password &&\n"
    b"         /^\\/(?:i\\/|combiner\\/)/.test(target.pathname)) return target.href;\n"
    b"      return IMAGE_HOSTS.has(target.hostname) ? origin+'/proxy?url='+encodeURIComponent(value) : value;\n"
    b"    }\n"
    b"    catch (_) { return value || ''; }\n"
    b"  };"
)

# The approved Red Sox P3 observer sometimes receives a detached IMG node.
# parentNode is null during an asynchronous mutation callback, and passing null
# to proxyImages() causes the legacy $ helper to throw. Use the document as the
# existing fallback, only in the cloned staging runtime. No rendered DOM, stats,
# event frequency or approved Gold Master bytes are changed.
REDSOX_RUNTIME = "runtime_redsox_p3_v7t.js"
REDSOX_DETACHED_IMG_ORIGINAL = b"if(node.tagName==='IMG')proxyImages(node.parentNode);"
REDSOX_DETACHED_IMG_GUARDED = b"if(node.tagName==='IMG')proxyImages(node.parentNode||document);"

# Rewrite only named JavaScript references in generated STAGING board HTML.
# No JS prototype overrides, DOM watchers, injected widgets, CSS or HTML art.
RUNTIME_REF = re.compile(
    rb'''(?P<quote>["'])/(?P<file>runtime(?:_[a-z0-9]+)*\.js)(?=[?"'])'''
)


def clone_staging_runtimes(output: Path):
    source_files = sorted(output.glob("runtime*.js"))
    if len(source_files) < 20:
        raise RuntimeError("Expected approved runtime assets; refusing image routing patch")
    dest = output / "staging" / "runtime"
    dest.mkdir(parents=True, exist_ok=True)
    replaced = 0
    filenames = set()
    for path in source_files:
        original = path.read_bytes()
        count = original.count(ORIGINAL_HELPER)
        if count > 1:
            raise RuntimeError(f"Unexpected multiple imageURL helpers: {path.name}")
        updated = original.replace(ORIGINAL_HELPER, STAGING_HELPER) if count else original
        if path.name == REDSOX_RUNTIME:
            if updated.count(REDSOX_DETACHED_IMG_ORIGINAL) != 1:
                raise RuntimeError("Red Sox observer source anchor changed; refuse staging patch")
            updated = updated.replace(REDSOX_DETACHED_IMG_ORIGINAL,
                                      REDSOX_DETACHED_IMG_GUARDED, 1)
        if count:
            replaced += 1
        (dest / path.name).write_bytes(updated)
        if path.read_bytes() != original:
            raise RuntimeError(f"Original runtime mutated: {path.name}")
        filenames.add(path.name)
    if replaced < 20:
        raise RuntimeError(f"Too few verified exact-helper replacements: {replaced}")
    return filenames, replaced


def rewrite_staging_script_links(html: bytes, filenames):
    used = []
    def substitute(match):
        name = match.group("file").decode("ascii")
        if name not in filenames:
            raise RuntimeError(f"Unverified runtime script referenced: {name}")
        used.append(name)
        return match.group("quote") + b"/staging/runtime/" + match.group("file")
    rewritten = RUNTIME_REF.sub(substitute, html)
    return rewritten, used

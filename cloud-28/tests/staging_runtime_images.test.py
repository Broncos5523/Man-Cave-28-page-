import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from staging_runtime_images import (ORIGINAL_HELPER, STAGING_HELPER, REDSOX_ORIGINAL, REDSOX_SAFE,
                                    clone_staging_runtimes, rewrite_staging_script_links)

class StagingImageSourceTests(unittest.TestCase):
    def test_copies_only_and_never_modifies_gold_master(self):
        with TemporaryDirectory() as d:
            out = Path(d)
            names = [f"runtime_test_{i}.js" for i in range(22)]
            for name in names:
                (out/name).write_bytes(b"const a=1;\n"+ORIGINAL_HELPER+b"\nconst b=2;")
            files, edited = clone_staging_runtimes(out)
            self.assertEqual(files, set(names))
            self.assertEqual(edited, 22)
            for name in names:
                original = (out/name).read_bytes()
                candidate = (out/"staging"/"runtime"/name).read_bytes()
                self.assertIn(ORIGINAL_HELPER, original)
                self.assertNotIn(STAGING_HELPER, original)
                self.assertIn(STAGING_HELPER, candidate)
                self.assertEqual(candidate.replace(STAGING_HELPER, ORIGINAL_HELPER), original)

    def test_redsox_null_observer_guard_changes_only_staging_clone(self):
        with TemporaryDirectory() as d:
            out = Path(d)
            for i in range(21):
                (out/f"runtime_test_{i}.js").write_bytes(b"const x=1;"+ORIGINAL_HELPER)
            name = "runtime_redsox_p3_v7t.js"
            original = b"const z=1;\n"+ORIGINAL_HELPER+b"\n"+REDSOX_ORIGINAL+b"\nconst end=1;"
            (out/name).write_bytes(original)
            clone_staging_runtimes(out)
            result = (out/"staging"/"runtime"/name).read_bytes()
            self.assertEqual((out/name).read_bytes(), original)
            self.assertIn(REDSOX_SAFE, result)
            self.assertNotIn(REDSOX_ORIGINAL, result)
            self.assertEqual(result.replace(REDSOX_SAFE,REDSOX_ORIGINAL).replace(STAGING_HELPER,ORIGINAL_HELPER),original)

    def test_only_staging_script_urls_are_rewritten(self):
        original = (b'<script src="/runtime_test_1.js?board=page1_nfl"></script>'
                    b'<script src="/ticker_nfl_final.mjs"></script>'
                    b'<img src="/cdn-inline/example.png">'
                    b'<script>const data="/proxy?url=example";</script>')
        patched, used = rewrite_staging_script_links(original, {"runtime_test_1.js"})
        self.assertEqual(used, ["runtime_test_1.js"])
        self.assertIn(b'/staging/runtime/runtime_test_1.js?board=page1_nfl', patched)
        self.assertIn(b'/ticker_nfl_final.mjs', patched)
        self.assertIn(b'/cdn-inline/example.png', patched)
        self.assertIn(b'/proxy?url=example', patched)

    def test_unapproved_runtime_reference_fails_closed(self):
        with self.assertRaises(RuntimeError):
            rewrite_staging_script_links(b'<script src="/runtime_unknown.js"></script>', set())

    def test_unexpected_original_does_not_receive_an_unsafe_patch(self):
        with TemporaryDirectory() as d:
            out = Path(d)
            for i in range(22):
                (out/f"runtime_test_{i}.js").write_text("const imageURL = altered")
            with self.assertRaisesRegex(RuntimeError, "Too few verified exact-helper replacements"):
                clone_staging_runtimes(out)

if __name__ == '__main__':
    unittest.main()

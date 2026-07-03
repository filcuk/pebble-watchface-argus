#!/usr/bin/env python3
"""Patch pebble-tool browser.py for Python 3.10 and Clay config URLs."""

from pathlib import Path

BROWSER_PY = Path.home() / (
    ".local/share/uv/tools/pebble-tool/lib/python3.10/site-packages/"
    "pebble_tool/util/browser.py"
)

OLD_BLOCK = """        else:
            # The URL argument length limit can quickly be exceeded by a Clay config page
            # so instead of providing the URL directly, write it to a temporary file.
            # Default Ubuntu firefox installation can't access /tmp
            # so place the temporary file in the user's home directory.
            with tempfile.NamedTemporaryFile(dir=os.path.expanduser("~"),
                                             delete=False,
                                             prefix="pebble-tool-emu-app-config-",
                                             suffix=".html") as temp:
                with open(temp.name, mode="w") as f:
                    f.write(f'<head><meta http-equiv="refresh" content="0;URL={url}"></head>')
                tempfile_url = f"file://{temp.name}"

                webbrowser.open_new(tempfile_url)
                self.serve_page(port, callback)"""

NEW_BLOCK = """        else:
            # The URL argument length limit can quickly be exceeded by a Clay config page
            # so instead of providing the URL directly, write it to a temporary file.
            # Default Ubuntu firefox installation can't access /tmp
            # so place the temporary file in the user's home directory.
            parsed = urlparse.urlparse(url)
            clay_html = None
            if parsed.fragment and "clay.pebble.com" in parsed.netloc:
                # Clay puts the config page in the URL fragment. Meta refresh breaks
                # because "#" ends the URL in HTML attributes, so serve the page locally.
                clay_html = urlparse.unquote(parsed.fragment)
                query_params = urlparse.parse_qs(parsed.query)
                return_to = query_params.get("return_to", [""])[0]
                clay_html = clay_html.replace("$$$RETURN_TO$$$", return_to)
                clay_html = clay_html.replace("$$RETURN_TO$$", return_to)

            with tempfile.NamedTemporaryFile(dir=os.path.expanduser("~"),
                                             delete=False,
                                             prefix="pebble-tool-emu-app-config-",
                                             suffix=".html") as temp:
                with open(temp.name, mode="w", encoding="utf-8") as f:
                    if clay_html is not None:
                        f.write(clay_html)
                    else:
                        # Meta refresh cannot carry URLs containing "#"; use JavaScript.
                        import json
                        f.write(
                            "<!DOCTYPE html><html><head><meta charset=\\"utf-8\\">"
                            "<script>location.replace({url});</script></head></html>".format(
                                url=json.dumps(url)
                            )
                        )
                tempfile_url = "file://{}".format(temp.name)

                webbrowser.open_new(tempfile_url)
                self.serve_page(port, callback)"""


PREVIOUS_NEW_BLOCK = NEW_BLOCK.replace(
    '                clay_html = clay_html.replace("$$RETURN_TO$$", return_to)\n',
    "",
)

RETURN_TO_UPGRADE = (
    '                clay_html = clay_html.replace("$$$RETURN_TO$$$", return_to)\n',
    '                clay_html = clay_html.replace("$$$RETURN_TO$$$", return_to)\n'
    '                clay_html = clay_html.replace("$$RETURN_TO$$", return_to)\n',
)


def main() -> None:
    if not BROWSER_PY.is_file():
        raise SystemExit(f"pebble-tool browser.py not found: {BROWSER_PY}")

    text = BROWSER_PY.read_text(encoding="utf-8")

    if NEW_BLOCK in text:
        print("browser.py already patched")
        return

    if PREVIOUS_NEW_BLOCK in text:
        text = text.replace(*RETURN_TO_UPGRADE)
        BROWSER_PY.write_text(text, encoding="utf-8")
        print(f"Upgraded Clay return URL handling in {BROWSER_PY}")
        return

    if OLD_BLOCK not in text:
        raise SystemExit("Expected browser.py block not found; pebble-tool version may differ")

    text = text.replace("delete_on_close=False", "delete=False")
    text = text.replace(OLD_BLOCK, NEW_BLOCK)
    BROWSER_PY.write_text(text, encoding="utf-8")
    print(f"Patched {BROWSER_PY}")


if __name__ == "__main__":
    main()

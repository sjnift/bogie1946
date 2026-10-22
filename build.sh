#!/bin/sh
# Builds four files from src/:
#   credits-roll.html / credits-roll-mobile.html: the Claude pages (no document skeleton; the publisher adds it)
#   *-standalone.html: the same pages wrapped as full documents, to open in a normal browser with a TMDB key
# With TMDB_KEY set, the key is written into the two standalone files only, so their owner never has to paste it.
set -e
cd "$(dirname "$0")"
SHARED="src/04-example.js src/05-core.js src/06-lookup.js src/06b-charts.js"
DESK_HEAD="src/01-head.html src/02-style.html"
DESK_BODY="src/03-body.html $SHARED src/07-render-a.js src/07-render-b.js src/08-events.js"
MOB_HEAD="src/m01-head.html"
MOB_BODY="src/m02-body.html $SHARED src/m03-screens.js src/m04-screens.js src/m05-events.js"

standalone() { # $1 = head files, $2 = body files
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  printf '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%%}[hidden]{display:none!important}</style>\n'
  cat $1
  printf '</head>\n<body>\n'
  cat $2
  printf '</body>\n</html>\n'
}
cat $DESK_HEAD $DESK_BODY > credits-roll.html
cat $MOB_HEAD $MOB_BODY > credits-roll-mobile.html
standalone "$DESK_HEAD" "$DESK_BODY" > credits-roll-standalone.html
standalone "$MOB_HEAD" "$MOB_BODY" > credits-roll-mobile-standalone.html

if [ -n "$TMDB_KEY" ]; then
  printf '%s' "$TMDB_KEY" | grep -Eq '^([0-9a-f]{32}|eyJ[A-Za-z0-9._-]+)$' || { echo "TMDB_KEY doesn't look like a TMDB key" >&2; exit 1; }
  for f in credits-roll-standalone.html credits-roll-mobile-standalone.html; do
    sed -i "s|\"\" /\*TMDB_KEY\*/|\"$TMDB_KEY\" /*TMDB_KEY*/|" "$f"
  done
fi

# The GitHub Pages site in docs/: both layouts on one origin, so they share one import and one saved key.
# Never takes TMDB_KEY: this site is public.
mkdir -p docs
standalone "$DESK_HEAD" "$DESK_BODY" | sed \
  -e 's|https://claude.ai/artifact/2RUkgC4dsysdz66WjJ6gzb" target="_blank" rel="noopener"|mobile.html"|' \
  -e 's|It keeps its own copy of your import, so import there too.|It uses the same import.|' > docs/desktop.html
standalone "$MOB_HEAD" "$MOB_BODY" | sed \
  -e 's|https://claude.ai/artifact/52oE5x53dcjUZgBYQMfPjR" target="_blank" rel="noopener"|desktop.html"|' \
  -e 's|It keeps its own copy of your import.|It uses the same import.|' > docs/mobile.html
cat > docs/index.html <<'HTML'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Credits Roll</title>
<script>
  var phone = matchMedia("(max-width: 700px)").matches || /iPhone|iPod|Android.+Mobile/.test(navigator.userAgent);
  location.replace(phone ? "mobile.html" : "desktop.html");
</script>
<style>body{margin:0;background:#14181C;color:#DDE6EE;font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}a{color:#40BCF4}</style>
</head>
<body><p>Opening Credits Roll… <a href="desktop.html">Desktop</a> · <a href="mobile.html">Phone</a></p></body>
</html>
HTML
touch docs/.nojekyll
if grep -rqE '"[0-9a-f]{32}" /\*TMDB_KEY\*/' docs; then echo "A TMDB key ended up in docs/; refusing to build the public site" >&2; rm -rf docs; exit 1; fi

#!/bin/sh
# Builds four files from src/:
#   credits-roll.html / credits-roll-mobile.html: the Claude pages (no document skeleton; the publisher adds it)
#   *-standalone.html: the same pages wrapped as full documents, to open in a normal browser with a TMDB key
# With TMDB_KEY set, the key is written into the two standalone files only, so their owner never has to paste it.
set -e
cd "$(dirname "$0")"
SHARED="src/04-example.js src/05-core.js src/05b-parts.js src/06-lookup.js src/06b-charts.js src/06d-letterboxd.js src/06c-insights.js src/06e-compare.js src/06f-reviews.js src/06g-drill.js src/06h-more.js src/06i-share.js src/06j-site.js src/06k-study.js src/06l-filter.js src/06m-story.js src/06n-world.js src/06o-map.js"
DESK_HEAD="src/01-head.html src/02-style.html"
DESK_BODY="src/03-body.html $SHARED src/07-render-a.js src/07-render-b.js src/07-render-c.js src/07-render-d.js src/07c-insights.js src/07d-compare.js src/07e-reviews.js src/07f-drill.js src/08-events.js"
MOB_HEAD="src/m01-head.html"
MOB_BODY="src/m02-body.html $SHARED src/m03-screens.js src/m04-screens.js src/m04b-stats.js src/m06-insights.js src/m07-compare.js src/m08-reviews.js src/m09-drill.js src/m10-route.js src/m05-events.js"

standalone() { # $1 = head files, $2 = body files
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  printf '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%%}[hidden]{display:none!important}</style>\n'
  cat $1
  printf '</head>\n<body>\n'
  cat $2
  printf '</body>\n</html>\n'
}
BUILT_AT=$(date -u +"%-d %b %Y, %H:%M UTC")
BUILT_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ") # the same moment, for the footer to show in the viewer's own time zone
stamp() { sed -e "s|<!--BUILD-->|$BUILT_AT|g" -e "s|<!--BUILT-ISO-->|$BUILT_ISO|g"; }
cat $DESK_HEAD $DESK_BODY | stamp > credits-roll.html
cat $MOB_HEAD $MOB_BODY | stamp > credits-roll-mobile.html
standalone "$DESK_HEAD" "$DESK_BODY" | stamp > credits-roll-standalone.html
standalone "$MOB_HEAD" "$MOB_BODY" | stamp > credits-roll-mobile-standalone.html

if [ -n "$TMDB_KEY" ]; then
  printf '%s' "$TMDB_KEY" | grep -Eq '^([0-9a-f]{32}|eyJ[A-Za-z0-9._-]+)$' || { echo "TMDB_KEY doesn't look like a TMDB key" >&2; exit 1; }
  for f in credits-roll-standalone.html credits-roll-mobile-standalone.html; do
    sed -i "s|\"\" /\*TMDB_KEY\*/|\"$TMDB_KEY\" /*TMDB_KEY*/|" "$f"
  done
fi

# The GitHub Pages site in docs/: both layouts on one origin, so they share one import and one saved key.
# Never takes TMDB_KEY: this site is public. It installs as an app: a manifest, icons and a service worker.
mkdir -p docs/icons docs/vendor
cp src/site/manifest.webmanifest src/site/sw.js src/site/og.png docs/
cp src/site/icons/*.png docs/icons/
# Papa Parse and JSZip come from the site itself, not a CDN, so nobody else can change what runs here
cp src/site/vendor/*.js docs/vendor/
VENDOR='s|https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js|vendor/papaparse.min.js|; s|https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js|vendor/jszip.min.js|' 
# What a shared link shows (WhatsApp, iMessage…): a title, a line and a picture (src/site/og.png, from tools/make_og.mjs)
SITE_URL="https://sjnift.github.io/bogie1946/"
PREVIEW='<meta name="description" content="Stats, insights and taste comparisons from your Letterboxd export.">\
<meta property="og:type" content="website">\
<meta property="og:site_name" content="Credits Roll">\
<meta property="og:title" content="Credits Roll: your Letterboxd diary, in numbers">\
<meta property="og:description" content="Stats, insights and taste comparisons from your Letterboxd export.">\
<meta property="og:url" content="'"$SITE_URL"'">\
<meta property="og:image" content="'"$SITE_URL"'og.png">\
<meta property="og:image:type" content="image/png">\
<meta property="og:image:width" content="1200">\
<meta property="og:image:height" content="630">\
<meta property="og:image:alt" content="Credits Roll: your Letterboxd diary, in numbers">\
<meta name="twitter:card" content="summary_large_image">'
# the preview comes first in the head: link-preview readers (WhatsApp…) look only at the top of a page
APP_HEAD="$PREVIEW"'\
<link rel="manifest" href="manifest.webmanifest">\
<meta name="theme-color" content="#1B2128">\
<meta name="mobile-web-app-capable" content="yes">\
<meta name="apple-mobile-web-app-capable" content="yes">\
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\
<meta name="apple-mobile-web-app-title" content="Credits Roll">\
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">\
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">'
SW_REGISTER='<script>if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { updateViaCache: \"none\" }).catch(() => {});</script>'
app() { sed -e "s|<meta charset=\"utf-8\">|<meta charset=\"utf-8\">\\
$APP_HEAD|" -e "s|</body>|$SW_REGISTER\\
</body>|"; }
standalone "$DESK_HEAD" "$DESK_BODY" | stamp | app | sed -e "$VENDOR" \
  -e 's|https://claude.ai/artifact/2RUkgC4dsysdz66WjJ6gzb" target="_blank" rel="noopener"|mobile.html"|' \
  -e 's|It keeps its own copy of your import, so import there too.|It uses the same import.|' > docs/desktop.html
standalone "$MOB_HEAD" "$MOB_BODY" | stamp | app | sed -e "$VENDOR" \
  -e 's|https://claude.ai/artifact/52oE5x53dcjUZgBYQMfPjR" target="_blank" rel="noopener"|desktop.html"|' \
  -e 's|It keeps its own copy of your import.|It uses the same import.|' -e 's|<title>Credits Roll Mobile</title>|<title>Credits Roll</title>|' > docs/mobile.html
cat > docs/index.html <<'HTML'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<!--PREVIEW-->
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Credits Roll</title>
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#1B2128">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<script>
  var phone = matchMedia("(max-width: 700px)").matches || /iPhone|iPod|Android.+Mobile/.test(navigator.userAgent);
  location.replace((phone ? "mobile.html" : "desktop.html") + location.hash);
</script>
<style>body{margin:0;background:#14181C;color:#DDE6EE;font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}a{color:#40BCF4}</style>
</head>
<body><p>Opening Credits Roll… <a href="desktop.html">Desktop</a> · <a href="mobile.html">Phone</a></p></body>
</html>
HTML
# the landing page carries the link preview too (it's the address people share)
printf '%s\n' "$PREVIEW" | sed 's/\\$//' > docs/.preview && sed -i -e '/<!--PREVIEW-->/{r docs/.preview' -e 'd}' docs/index.html && rm docs/.preview
touch docs/.nojekyll
# the site's pages run only their own code (see tools/csp.mjs)
node tools/csp.mjs docs/desktop.html docs/mobile.html docs/index.html
if grep -q "cdnjs.cloudflare.com" docs/*.html; then echo "A page still loads a script from a CDN" >&2; exit 1; fi
if grep -rqE '"[0-9a-f]{32}" /\*TMDB_KEY\*/' docs; then echo "A TMDB key ended up in docs/; refusing to build the public site" >&2; rm -rf docs; exit 1; fi

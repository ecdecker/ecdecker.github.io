# Research map design

The homepage research map is a progressively enhanced list of links drawn on a
geographically faithful world land mask. A post joins the map by declaring one or more
`locations` in front matter; Hugo projects those coordinates and writes normal
links into the SVG at build time.

## Performance plan

The component has three firm constraints:

- no JavaScript, tile service, remote subresource, or browser-side data fetch;
- the land image uses native lazy loading and remains a local resource;
- map-only CSS must not inflate article or taxonomy responses.

The land source is COBE's 256×128, one-bit equirectangular mask, derived from
Wikimedia's public-domain `World_map_blank_without_borders.svg`. The local
image uses `loading="lazy"`; its dimensions reserve the complete map area while
the immediately available SVG overlay provides linked markers. Each pixel
represents 1.40625 degrees in both axes. This is accurate at the component's
display scale, though it is deliberately not a political-boundary or survey
map.

`npm run site -- assets map` can reproduce the checked-in mask from a pinned
COBE revision. The command and every build verify its SHA-256 checksum and
256×128 dimensions. A detailed GeoJSON outline or mapping library would spend
substantially more bytes without improving location selection at this scale.

The shared inline-CSS partial compiles both the global bundle and the separate
homepage map bundle. The map-specific CSS is 1,306 bytes (533 bytes with
deterministic gzip), and the lazy land image is 1,108 bytes. The 2026-09-04
production measurement is 91,600 bytes cold / 63,371 bytes gzip and 39,282
bytes cached / 11,022 bytes gzip. Run `npm run site -- build` to print the
current measurement after future changes.

## Content contract

```yaml
locations:
  - name: "Saint Paul, Minnesota, United States"
    latitude: 44.9537
    longitude: -93.09
```

`locations` is optional and repeatable. Presence alone opts the post into the
map, avoiding a second tag or checkbox that could disagree with the coordinate
data. The build rejects missing names, non-numeric values, latitudes outside
-90…90, and longitudes outside -180…180. Pages CMS applies the same numeric
bounds in its authoring controls.

Only pages available in the current language are mapped. Drafts remain visible
in the normal preview but cannot leak into a production map, and an
untranslated English note does not appear as fallback content on translated
homepages.

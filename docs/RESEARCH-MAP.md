# Research map design

The homepage research map is a progressively enhanced list of links drawn on a
coarse world silhouette. A post joins the map by declaring one or more
`locations` in front matter; Hugo projects those coordinates and writes normal
links into the SVG at build time.

## Performance plan

The component has three firm constraints:

- no JavaScript, tile service, remote subresource, or browser-side data fetch;
- no new request—the silhouette, markers, and map-only CSS are in the homepage
  HTML;
- map-only CSS must not inflate article or taxonomy responses.

An inline coarse SVG sits on the useful frontier for this site. A raster would
cost a request and scale less cleanly; a detailed GeoJSON outline would add
geometry readers do not need; a mapping library or tile layer would violate
the no-JavaScript and isolation policies. The map therefore keeps only enough
continental geometry to orient a reader and spends its interaction budget on
linked markers and a linked text key.

The shared inline-CSS partial compiles both the global bundle and the separate
homepage map bundle. The source map CSS is 1,302 bytes (508 bytes with
deterministic gzip). The 2026-09-04 production measurement was 92,022 bytes
cold / 63,623 bytes gzip and 39,704 bytes cached / 11,274 bytes gzip. Run
`npm run site -- build` to print the current homepage measurement after future
changes.

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

# browser_zipit
This is an example of using a ZIP archive to serve tiles. It closely follows the 
[OpenSeadragon custom tilesource example](https://openseadragon.github.io/examples/tilesource-custom/)
and draws on a json syntax creates by [OurDigitalWorld](https://ourdigitalworld.org/) to identify
byte-ranges to extract content. The values are mostly self-explanatory:
```
{
    "@id": "AECHO_18750101",
    "file_size": 45633749,
    "manifest_offset": 43,
    "manifest_size": 5363,
    "zip_offsets": [
        {
            "ident": "AECHO_18750101/1875-01-01-0001",
            "coll_offset": 39290204,
            "coll_size": 6342892,
            "dir_offset": 45605830,
            "dir_size": 27266,
            "ztype": "blocks"
        },
        {
            "ident": "AECHO_18750101/1875-01-01-0001",
            "coll_offset": 31117809,
            "coll_size": 8172339,
            "dir_offset": 39212759,
            "dir_size": 77389,
            "ztype": "tiles"
            ...
```
The example here uses the ztype _tiles_ but there is a similar approach used for _blocks_, which is used to
associate image snippets with OCR. To replicate the setup, the files here need to be copied to
a web folder. The key value is in _index.html_ where the _BASE_URL_ is defined:
```
    <script type="text/javascript">
        var BASE_URL = "https://collections.uwindsor.ca/login";
    </script>
```
In order to avoid CORS headaches between http and https access, OpenSeadragon is defined as a
local installation in _index.js_. The distribution can be found on the 
[OpenSeadragon Download page](https://openseadragon.github.io/#download) or the configuration
can pull from a CDN.

IIIF viewers use OpenSeadragon for tile handling, and the idea is that this would be some of
the needed plumbing for a ZIP implementation.

/*
    zipit.js - work with ODW zip archive layout

    This is one approach to work with byte range requests against
    a zip archive. OpenSeadragon has an example of using custom
    tile sources here which I have followed closely:

        https://openseadragon.github.io/examples/advanced-data-model/

    The ZIP format is described in these sources:

        https://docs.fileformat.com/compression/zip/
        https://users.cs.jmu.edu/buchhofp/forensics/formats/pkzip.html

    For more details, see the documentation here:

        https://github.com/OurDigitalWorld/browser_zipit

    - art rhyno, u. of windsor & ourdigitalworld
*/

//how long to wait on a network request
var TIMEOUT = 5000;

//zip format values, these should not need to be changed
var CENTRAL_DIR_START = 46; //we look for the file name, which starts in this position
var FILE_NAME_LEN_POS = 28; //position of file name len (always get this from directory!)
var EXTRA_FIELD_LEN_POS = 30; //position of extra field len (if any)
var FIELD_COMMENT_LEN_POS = 32; //positon of field comment (if any)
var COMP_SIZE_POS = 20; //position of size of file (we don't deal with compression so matches original)
var REL_OFFSET_POS = 42; //offset from start of archive to local file header
var LOCAL_FILE_HEADER_LEN = 30; //length of local file header (which we will skip)

var FALLBACK = "fallback.jpg";
var tile_dir = "";
var zip_spec = null;

//use FileReader to convert blob to bytes
function getBuffer(fileData) {
    return function(resolve) {
        var reader = new FileReader();
        reader.readAsArrayBuffer(fileData);
        reader.onload = function() {
            var arrayBuffer = reader.result
            var bytes = new Uint8Array(arrayBuffer);
            resolve(bytes);
        }//reader.onload
    }//function
}//getBuffer

//convert 4 byte value to int
function sortOutInt4(data,pos,num) {
    var u32bytes = data.buffer.slice(pos, pos + 4);
    var uint = new Uint32Array(u32bytes)[0];
    return uint;
}//sortOutInt4

//convert 2 byte value to int
function sortOutInt2(data,pos,num) {
    var u16bytes = data.buffer.slice(pos, pos + 2);
    var uint = new Uint16Array(u16bytes)[0];
    return uint;
}//sortOutInt2

//the odw.json holds the coordinates for the zip archive
async function sortOutZipSpec(issue) {
    var issue_parts = issue.split("/");
    var page = issue_parts.pop();
    var issue_ident = issue_parts.join("/");
    var json_url = BASE_URL + "/" + issue_ident + "/odw.json";
    var this_spec = null;

    if (page && issue) {
         const json_file = await fetch(json_url).then(res => res.json())
         for (var zip_offset of json_file.zip_offsets) {
             if (zip_offset.ident.includes(page) &&
                 zip_offset.ztype.includes("tiles"))
             {
                 this_spec = { zip_url: json_url.replace(".json",".zip"),
                              coll_offset: zip_offset.coll_offset,
                              dir_offset: zip_offset.dir_offset,
                              dir_size: zip_offset.dir_size };
                 break;
             }//if
         }//for
    }//if

    return this_spec;
}//sortOutZipSpec

//loop through the ZIP directory
function sortOutZipDir(tile_req) {
    var cdr_len = tile_dir.length;
    var base_pos = 0;
    var tile_size = 0;
    var tile_offset = 0;
    while ((base_pos + FIELD_COMMENT_LEN_POS) < cdr_len) { 
        var fn_len = sortOutInt2(tile_dir,base_pos + FILE_NAME_LEN_POS);
        var ef_len = sortOutInt2(tile_dir,base_pos + EXTRA_FIELD_LEN_POS);
        var fc_len = sortOutInt2(tile_dir,base_pos + FIELD_COMMENT_LEN_POS);
        var fn_offset = base_pos + CENTRAL_DIR_START;
        var ufn = tile_dir.buffer.slice(fn_offset, fn_offset + fn_len);
        var fn = new TextDecoder('ascii').decode(ufn);
        if (fn.includes(tile_req)) {
            tile_size = sortOutInt4(tile_dir,base_pos + COMP_SIZE_POS);
            tile_offset = sortOutInt4(tile_dir,base_pos + REL_OFFSET_POS);
            tile_offset = tile_offset + zip_spec.coll_offset + 
                LOCAL_FILE_HEADER_LEN + fn_len + ef_len + fc_len;
            break;
        }//if
        base_pos += (CENTRAL_DIR_START + fn_len + ef_len + fc_len);
    }//while

    tile_spec = { size: tile_size, offset: tile_offset };
    return tile_spec;
}//sortOutZipDir

//comment below is carry-over from sample code
//see https://stackoverflow.com/questions/41996814/how-to-abort-a-fetch-request
//we need to provide the possibility to abort fetch(...)
async function zipFetch(input, init) {
    let controller = new AbortController();
    let signal = controller.signal;
    init = Object.assign({signal}, init);

    var zip_parts = input.split("/tiles/");
    var tile_spec = null;

    if (zip_parts.length > 1) {
        if (zip_spec == null ) zip_spec = await sortOutZipSpec(zip_parts[0]);
    }//if
    
    //need all of this information to proceed
    if (zip_spec && zip_spec.zip_url && zip_spec.dir_size >= 0 &&
        zip_spec.coll_offset >= 0 && zip_spec.dir_offset >= 0)
    {
        if (tile_dir.length == 0) {
            await fetch(zip_spec.zip_url, { timeout: TIMEOUT,
                headers: {"Range":"bytes=" + zip_spec.dir_offset + "-" +
                (zip_spec.dir_offset + (zip_spec.dir_size -1))}})
                .then(res => res.blob())
                .catch((error) => {
                   console.log("directory error",error);
                })
                .then(blob => {
                    let promise = new Promise(getBuffer(blob),init);
                    promise.controller = controller;
                    promise.then(function(buffer) {
                        tile_dir = buffer;
                    });
                });
        }//if
        if (tile_dir.length > 0) tile_spec = sortOutZipDir(zip_parts[1]); 
    }//if

    if (zip_spec && tile_spec) {
        let promise = fetch(zip_spec.zip_url, { timeout: TIMEOUT,
                headers: {"Range":"bytes=" + tile_spec.offset + "-" +
                (tile_spec.offset + (tile_spec.size -1))}},init);
        promise.controller = controller;
        return promise;
    } 
    let promise = fetch(FALLBACK, init);

    promise.controller = controller;
    return promise;
}

OpenSeadragon.extend( OpenSeadragon.IIIFTileSource.prototype, {
        getTilePostData: function( level, x, y ) {
            //comment below is carry-over from sample code
            //here we exploit the POST API, a handy shortcut to pass ourselves
            //an instance to the tile object
            //return tile;
            return {width: this.getTileWidth(), height: this.getTileHeight()};
        },
        getTileAjaxHeaders: function( level, x, y ) {
            //comment below is carry-over from sample code
            // to avoid CORS problems
            return {
                'Content-Type': 'application/octet-stream',
                'Access-Control-Allow-Origin': '*'
            };
        },
        downloadTileStart: function(imageJob) {
            //comment below is carry-over from sample code
            // namespace where we attach our properties to avoid
            // collision with API
            let context = imageJob.userData;
            context.image = new Image();

            //comment below is carry-over from sample code
            // in all scenarios, unless abort() is called, make
            // sure imageJob.finish() gets executed!
            context.image.onerror = context.image.onabort = function() {
                imageJob.finish(null, context.promise, "Failed to parse tile data as an Image");
            };
            context.image.onload = function() {
                imageJob.finish(context.image, context.promise);
            };

            //comment below is carry-over from sample code
            // note we ignore some imageJob properties such as
            // 'loadWithAjax'. This means preventing OSD from using
            // ajax will have no effect as we force it to do so.
            // Make sure you implement all the features the official
            // implementation do if you want to keep them.
            context.promise = zipFetch(imageJob.src, {
                method: "GET",
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'same-origin',
                headers: imageJob.ajaxHeaders || {},
                body: null
            }).then(data => {
                return data.blob();
            }).then(blob => {
		var urlCreator = window.URL || window.webkitURL;
                context.image.src = urlCreator.createObjectURL(blob);
            });

        },
        downloadTileAbort: function(imageJob) {
            imageJob.userData.promise.controller.abort();
        }
});


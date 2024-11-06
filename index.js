//OpenSeadragon config
let viewer = (window.viewer = OpenSeadragon({
  element: "viewer",
  prefixUrl: "openseadragon-bin-5.0.0/images/",
  minZoomImageRatio: 0.01,
  visibilityRatio: 0,
  crossOriginPolicy: "Anonymous",
  ajaxWithCredentials: true,
  sequenceMode: true,
  tileSources: [ "info.json" ]
}));


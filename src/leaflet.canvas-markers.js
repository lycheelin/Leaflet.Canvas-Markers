'use strict';

(function (factory, window){
  // define an AMD module that relies on 'leaflet'
  if (typeof define === 'function' && define.amd) {
    define(['leaflet'], factory);

  // define a Common JS module that relies on 'leaflet'
  } else if (typeof exports === 'object') {
    module.exports = factory(require('leaflet'));
  }

  // attach your plugin to the global 'L' variable
  if (typeof window !== 'undefined' && window.L) {
    window.L.CanvasIconLayer = factory(L);
  }
}(function (L){
  var CanvasIconLayer = (L.Layer ? L.Layer : L.Class).extend({
    initialize: function (options) {
      L.setOptions(this, options);
    },

    setOptions: function (options) {
      L.setOptions(this, options);
      if (this._canvas) {
        this._updateOptions();
      }
      return this.redraw();
    },

    redraw: function () {
      this._redraw(true);
    },

    addMarker: function (marker) {
      L.Util.stamp(marker);

      if (!this._markers) this._markers = {};

      this._markers[marker._leaflet_id] = marker;

      this._drawMarker(marker);
    },

    addLayer: function (layer) {
      if ((layer.options.pane == 'markerPane') && layer.options.icon) this.addMarker(layer);
      else console.error('Layer isn\'t a marker');
    },

    removeLayer: function (layer) {
      this.removeMarker(layer, true);
    },

    removeMarker: function (marker, redraw) {
      delete this._markers[marker._leaflet_id];
      if (redraw) {
        this._redraw(true);
      }
    },

    onAdd: function (map) {
      this._map = map;
      this._onClickListeners = [];

      if (!this._canvas) {
        this._initCanvas();
      }

      if (this.options.pane) {
        this.getPane().appendChild(this._canvas);
      } else {
        map._panes.overlayPane.appendChild(this._canvas);
      }

      map.on('moveend', this._reset, this);
      map.on('click', this._executeClickListeners, this);
      map.on('zoomstart', this._clearLayer, this);
      map.on('mousemove', L.Util.throttle(this._handleMouseHover, 120, this), this);
    },

    onRemove: function (map) {
      if (this.options.pane) {
        this.getPane().removeChild(this._canvas);
      } else {
        map.getPanes().overlayPane.removeChild(this._canvas);
      }

      map.off('moveend', this._reset, this);
      map.off('click', this._executeClickListeners, this);
      map.off('zoomstart', this._clearLayer, this);
      map.off('mousemove', L.Util.throttle(this._handleMouseHover, 120, this), this);
    },

    addTo: function (map) {
      map.addLayer(this);
      return this;
    },

    _clearLayer:function () {
      this._context && this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
    },

    _handleMouseHover:function(event){
      L.DomUtil.removeClass(this._canvas, 'leaflet-interactive');
      for (var markerId in this._markers) {
        var marker = this._markers[markerId];
        var point = this._map.latLngToContainerPoint(this._markers[markerId].getLatLng());

        if (this._hit(marker, point, event)) {
          L.DomUtil.addClass(this._canvas, 'leaflet-interactive');
          break;
        }
      }
    },

    _drawMarker: function (marker) {
      var self = this;

      var pointPos = this._map.latLngToContainerPoint(marker.getLatLng());

      if (!marker.canvas_img){
        marker.canvas_img = new Image();
        marker.canvas_img.src = marker.options.icon.options.iconUrl;
        marker.canvas_img.onload = function() {
          self._drawImage(marker, pointPos);
        }
      } else {
        self._drawImage(marker, pointPos);
      }
    },

    _drawImage: function (marker, pointPos) {
      // 增加图片方向旋转功能，暂不开启
      // this._context.translate(pointPos.x,pointPos.y)
      // this._context.rotate(30 * Math.PI / 180);//旋转30度
      // 把下面 pointPos.x 和 pointPos.y 都改为 0
      this._context.drawImage(
          marker.canvas_img,
          pointPos.x - marker.options.icon.options.iconAnchor[0],
          pointPos.y - marker.options.icon.options.iconAnchor[1],
          marker.options.icon.options.iconSize[0],
          marker.options.icon.options.iconSize[1]
        );
      // this._context.rotate(330 * Math.PI / 180);//旋转 360 - 30 度 复原
      // this._context.translate(-pointPos.x,-pointPos.y)
    },

    _reset: function () {
      var topLeft = this._map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(this._canvas, topLeft);

      var size = this._map.getSize();

      this._canvas.width = size.x;
      this._canvas.height = size.y;

      this._redraw();
    },

    _redraw: function (clear) {
      if (!this._map) {
          return;
      }

      if (clear) {
        this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
      }

      Object.keys(this._markers).forEach(function(item){
        this._drawMarker(this._markers[item]);
      }, this)
    },

    _initCanvas: function () {
      this._canvas = L.DomUtil.create('canvas', 'leaflet-canvas-icon-layer leaflet-layer');
      var originProp = L.DomUtil.testProp(['transformOrigin', 'WebkitTransformOrigin', 'msTransformOrigin']);
      this._canvas.style[originProp] = '50% 50%';

      var size = this._map.getSize();
      this._canvas.width  = size.x;
      this._canvas.height = size.y;

      this._context = this._canvas.getContext('2d');

      var animated = this._map.options.zoomAnimation && L.Browser.any3d;
      L.DomUtil.addClass(this._canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'));
    },

    _updateOptions: function () {

    },

    addOnClickListener: function (listener) {
      if(!this._onClickListeners) {
        this._onClickListeners = [];
      }
      this._onClickListeners.push(listener);
    },

    _executeClickListeners: function(event) {
      for (var markerId in this._markers) {
        var marker = this._markers[markerId];
        var point = this._map.latLngToContainerPoint(this._markers[markerId].getLatLng());

        if (this._hit(marker, point, event)) {
          this._onClickListeners.forEach(function(listener) { listener(event, marker); });
          break;
        }
      }
    },

    _hit: function(marker, point, event) {
      var width = marker.options.icon.options.iconSize[0];
      var height = marker.options.icon.options.iconSize[1];

      var top = marker.options.icon.options.iconAnchor[1] + 1;
      var bottom = height - marker.options.icon.options.iconAnchor[1] + 1;
      var left = marker.options.icon.options.iconAnchor[0] + 1;
      var right = width - marker.options.icon.options.iconAnchor[0] + 1;

      var x = event.containerPoint.x;
      var y = event.containerPoint.y;
      return x <= point.x + right && x >= point.x - left && y >= point.y - top && y <= point.y + bottom;
    }
  });

  L.canvasIconLayer = function (options) {
    return new CanvasIconLayer(options);
  };
}, window));

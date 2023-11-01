/*!
 * echarts-extension-tmap 
 * @version 1.0.0
 * @author undefined
 * 
 * MIT License
 * 
 * Copyright (c) 2019-2022 Zhongxiang Wang
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('echarts/lib/echarts')) :
  typeof define === 'function' && define.amd ? define(['exports', 'echarts/lib/echarts'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.echarts = global.echarts || {}, global.echarts.amap = {}), global.echarts));
})(this, (function (exports, echarts) { 'use strict';

  var ecVer = echarts.version.split('.');
  var isNewEC = ecVer[0] > 4;
  var COMPONENT_TYPE = 'tmap';
  function v2Equal(a, b) {
    return a && b && a[0] === b[0] && a[1] === b[1];
  }
  var logMap = {};
  function logWarn(tag, msg, once) {
    var log = "[ECharts][Extension][TMap]".concat(tag ? ' ' + tag + ':' : '', " ").concat(msg);
    once && logMap[log] || console.warn(log);
    once && (logMap[log] = true);
  }
  function clearLogMap() {
    logMap = {};
  }

  function dataToCoordSize(dataSize, dataItem) {
    dataItem = dataItem || [0, 0];
    return echarts.util.map([0, 1], function (dimIdx) {
      var val = dataItem[dimIdx];
      var halfSize = dataSize[dimIdx] / 2;
      var p1 = [];
      var p2 = [];
      p1[dimIdx] = val - halfSize;
      p2[dimIdx] = val + halfSize;
      p1[1 - dimIdx] = p2[1 - dimIdx] = dataItem[1 - dimIdx];
      return Math.abs(this.dataToPoint(p1)[dimIdx] - this.dataToPoint(p2)[dimIdx]);
    }, this);
  }
  var excludedOptions = ['echartsLayerInteractive', 'renderOnMoving', 'largeMode', 'layers'];
  function TMapCoordSys(tmap, api) {
    this._tmap = tmap;
    this._api = api;
    this._mapOffset = [0, 0];
  }
  var TMapCoordSysProto = TMapCoordSys.prototype;
  TMapCoordSysProto.setZoom = function (zoom) {
    this._zoom = zoom;
  };
  TMapCoordSysProto.setCenter = function (center) {
    var lnglat = new T.LngLat(center[0], center[1]);
    this._center = this._tmap.lngLatToContainerPoint(lnglat);
  };
  TMapCoordSysProto.setMapOffset = function (mapOffset) {
    this._mapOffset = mapOffset;
  };
  TMapCoordSysProto.setTMap = function (tmap) {
    this._tmap = tmap;
  };
  TMapCoordSysProto.getTMap = function () {
    return this._tmap;
  };
  TMapCoordSysProto.dataToPoint = function (data) {
    var lnglat = new T.LngLat(data[0], data[1]);
    var px = this._tmap.lngLatToContainerPoint(lnglat);
    var mapOffset = this._mapOffset;
    return [px.x - mapOffset[0], px.y - mapOffset[1]];
  };
  TMapCoordSysProto.pointToData = function (pt) {
    var mapOffset = this._mapOffset;
    var lnglat = this._tmap.containerPointToLngLat(new T.Point(pt[0] + mapOffset[0], pt[1] + mapOffset[1]));
    return [lnglat.lng, lnglat.lat];
  };
  TMapCoordSysProto.getViewRect = function () {
    var api = this._api;
    return new echarts.graphic.BoundingRect(0, 0, api.getWidth(), api.getHeight());
  };
  TMapCoordSysProto.getRoamTransform = function () {
    return echarts.matrix.create();
  };
  TMapCoordSysProto.prepareCustoms = function () {
    var rect = this.getViewRect();
    return {
      coordSys: {
        type: COMPONENT_TYPE,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      },
      api: {
        coord: echarts.util.bind(this.dataToPoint, this),
        size: echarts.util.bind(dataToCoordSize, this) // TODO: FIXME
      }
    };
  };

  TMapCoordSysProto.convertToPixel = function (ecModel, finder, value) {
    // here we don't use finder as only one tmap component is allowed
    return this.dataToPoint(value);
  };
  TMapCoordSysProto.convertFromPixel = function (ecModel, finder, value) {
    // here we don't use finder as only one tmap component is allowed
    return this.pointToData(value);
  };

  // less useful
  // TMapCoordSysProto.containPoint = function(point) {
  //   return this._tmap.getBounds().contains(this.pointToData(point));
  // }

  TMapCoordSys.create = function (ecModel, api) {
    var tmapCoordSys;
    ecModel.eachComponent(COMPONENT_TYPE, function (tmapModel) {
      if (typeof T === 'undefined') {
        throw new Error('T api is not loaded');
      }
      if (tmapCoordSys) {
        throw new Error('Only one tmap component is allowed');
      }
      var tmap = tmapModel.getTMap();
      var echartsLayerInteractive = tmapModel.get('echartsLayerInteractive');
      if (!tmap) {
        var root = api.getDom();
        var painter = api.getZr().painter;
        var viewportRoot = painter.getViewportRoot();
        viewportRoot.className = COMPONENT_TYPE + '-ec-layer';
        // PENDING not hidden?
        viewportRoot.style.visibility = 'hidden';
        var className = 'ec-extension-' + COMPONENT_TYPE;
        // Not support IE8
        var tmapRoot = root.querySelector('.' + className);
        if (tmapRoot) {
          // Reset viewport left and top, which will be changed
          // in moving handler in tmapView
          viewportRoot.style.left = '0px';
          viewportRoot.style.top = '0px';
          root.removeChild(tmapRoot);
        }
        tmapRoot = document.createElement('div');
        tmapRoot.className = className;
        tmapRoot.style.cssText = 'position:absolute;top:0;left:0;bottom:0;right:0;';
        root.appendChild(tmapRoot);
        var options = echarts.util.clone(tmapModel.get());
        // delete excluded options
        echarts.util.each(excludedOptions, function (key) {
          delete options[key];
        });
        tmap = new T.Map(tmapRoot, options);
        var nativeSetMapStyle = tmap.setStyle;
        tmap.setStyle = function () {
          var style = arguments[0];
          logWarn('style', style);
          nativeSetMapStyle.apply(this, arguments);
          tmapModel.__mapStyle = style;
        };
        setTimeout(function () {
          tmapRoot.appendChild(viewportRoot);
          viewportRoot.style.visibility = '';
          viewportRoot.style.zIndex = 1000;
        }, 10 * 2);
        tmapModel.setTMap(tmap);
        tmapModel.setRoot(tmapRoot);
        tmapModel.setEChartsLayer(viewportRoot);

        // Override
        painter.getViewportRootOffset = function () {
          return {
            offsetLeft: 0,
            offsetTop: 0
          };
        };
      }
      var oldEChartsLayerInteractive = tmapModel.__echartsLayerInteractive;
      if (oldEChartsLayerInteractive !== echartsLayerInteractive) {
        tmapModel.setEChartsLayerInteractive(echartsLayerInteractive);
        tmapModel.__echartsLayerInteractive = echartsLayerInteractive;
      }
      var center = tmapModel.get('center');
      var zoom = tmapModel.get('zoom');
      if (center && zoom) {
        var tmapCenter = tmap.getCenter();
        var tmapZoom = tmap.getZoom();
        var centerOrZoomChanged = tmapModel.centerOrZoomChanged([tmapCenter.lng, tmapCenter.lat], tmapZoom);
        if (centerOrZoomChanged) {
          tmap.centerAndZoom(new T.LngLat(center[0], center[1]), zoom);
        }
      }

      // update map style(#13)
      var originalMapStyle = tmapModel.__mapStyle;
      var newMapStyle = tmapModel.get('mapStyle');
      if (originalMapStyle !== newMapStyle) {
        tmap.setStyle(tmapModel.__mapStyle = newMapStyle);
      }
      tmapCoordSys = new TMapCoordSys(tmap, api);
      tmapCoordSys.setMapOffset(tmapModel.__mapOffset || [0, 0]);
      tmapCoordSys.setZoom(zoom);
      tmapCoordSys.setCenter(center);
      tmapModel.coordinateSystem = tmapCoordSys;
    });
    ecModel.eachSeries(function (seriesModel) {
      if (seriesModel.get('coordinateSystem') === COMPONENT_TYPE) {
        // inject coordinate system
        seriesModel.coordinateSystem = tmapCoordSys;
      }
    });

    // return created coordinate systems
    return tmapCoordSys && [tmapCoordSys];
  };
  TMapCoordSysProto.dimensions = TMapCoordSys.dimensions = ['lng', 'lat'];
  TMapCoordSysProto.type = COMPONENT_TYPE;

  var TMapModel = {
    type: COMPONENT_TYPE,
    setTMap: function setTMap(tmap) {
      this.__tmap = tmap;
    },
    getTMap: function getTMap() {
      return this.__tmap;
    },
    setRoot: function setRoot(root) {
      this.__root = root;
    },
    getRoot: function getRoot(root) {
      return this.__root;
    },
    setEChartsLayer: function setEChartsLayer(layer) {
      this.__echartsLayer = layer;
    },
    getEChartsLayer: function getEChartsLayer() {
      return this.__echartsLayer;
    },
    setEChartsLayerVisibility: function setEChartsLayerVisibility(visible) {
      this.__echartsLayer.style.display = visible ? 'block' : 'none';
    },
    // FIXME: NOT SUPPORT <= IE 10
    setEChartsLayerInteractive: function setEChartsLayerInteractive(interactive) {
      this.option.echartsLayerInteractive = !!interactive;
      this.__echartsLayer.style.pointerEvents = interactive ? 'auto' : 'none';
    },
    setCenterAndZoom: function setCenterAndZoom(center, zoom) {
      this.option.center = center;
      this.option.zoom = zoom;
    },
    centerOrZoomChanged: function centerOrZoomChanged(center, zoom) {
      var option = this.option;
      return !(v2Equal(center, option.center) && zoom === option.zoom);
    },
    defaultOption: {
      center: [116.397428, 39.90923],
      zoom: 5,
      resizeEnable: true,
      // extension specific options
      echartsLayerInteractive: true,
      renderOnMoving: false,
      largeMode: false
    }
  };
  var TMapModel$1 = isNewEC ? echarts.ComponentModel.extend(TMapModel) : TMapModel;

  var TMapView = {
    type: COMPONENT_TYPE,
    init: function init() {
      this._isFirstRender = true;
    },
    render: function render(tmapModel, ecModel, api) {
      var rendering = true;
      var tmap = tmapModel.getTMap();
      var viewportRoot = api.getZr().painter.getViewportRoot();
      var offsetEl = tmapModel.getRoot();
      var coordSys = tmapModel.coordinateSystem;
      var renderOnMoving = tmapModel.get("renderOnMoving");
      var resizeEnable = tmapModel.get("resizeEnable");
      var largeMode = tmapModel.get("largeMode");
      var moveHandler = function moveHandler(e) {
        if (rendering) {
          return;
        }
        var offsetElStyle = offsetEl.style;
        var mapOffset = [-parseInt(offsetElStyle.left, 10) || 0, -parseInt(offsetElStyle.top, 10) || 0];
        // only update style when map offset changed
        var viewportRootStyle = viewportRoot.style;
        var offsetLeft = mapOffset[0] + "px";
        var offsetTop = mapOffset[1] + "px";
        if (viewportRootStyle.left !== offsetLeft) {
          viewportRootStyle.left = offsetLeft;
        }
        if (viewportRootStyle.top !== offsetTop) {
          viewportRootStyle.top = offsetTop;
        }
        coordSys.setMapOffset(tmapModel.__mapOffset = mapOffset);
        var actionParams = {
          type: "tmapRoam",
          animation: {
            // compatible with ECharts 5.x
            // no delay for rendering but remain animation of elements
            duration: 0
          }
        };
        api.dispatchAction(actionParams);
      };
      if (this._moveHandlerPerformance) {
        tmap.off("move", this._moveHandlerPerformance);
      }
      // 移除上一次监听
      if (this._resizeHandler) {
        tmap.off("resize", this._resizeHandler);
      }
      if (this._moveStartHandler) {
        tmap.off("movestart", this._moveStartHandler);
      }
      if (this._moveEndHandler) {
        tmap.off("moveend", this._moveEndHandler);
        tmap.off("zoomend", this._moveEndHandler);
      }
      if (!renderOnMoving) {
        this._moveStartHandler = function () {
          setTimeout(function () {
            tmapModel.setEChartsLayerVisibility(false);
          }, 0);
        };
        tmap.on("movestart", this._moveStartHandler);
      } else {
        this._moveHandlerPerformance = echarts.throttle(moveHandler, 14, true);
        tmap.on("move", this._moveHandlerPerformance);
      }
      // 移动结束渲染
      this._moveEndHandler = function (e) {
        moveHandler();
        // 展示隐藏图层
        if (!renderOnMoving) {
          setTimeout(function () {
            tmapModel.setEChartsLayerVisibility(true);
          }, 0);
        }
      };
      tmap.on("moveend", this._moveEndHandler);
      tmap.on("zoomend", this._moveEndHandler);
      if (resizeEnable) {
        var resizeHandler = function resizeHandler() {
          echarts.getInstanceByDom(api.getDom()).resize();
        };
        if (largeMode) {
          resizeHandler = echarts.throttle(resizeHandler, 20, true);
        }
        tmap.on("resize", this._resizeHandler = resizeHandler);
      }
      this._isFirstRender = rendering = false;
    },
    dispose: function dispose() {
      clearLogMap();
      var component = this.__model;
      if (component) {
        var root = component.getRoot();
        if (root) {
          root.innerHTML = "";
        }
        component.setTMap(null);
        component.setEChartsLayer(null);
        if (component.coordinateSystem) {
          component.coordinateSystem.setTMap(null);
          component.coordinateSystem = null;
        }
        delete this._resizeHandler;
        delete this._moveStartHandler;
        delete this._moveEndHandler;
        delete this._moveHandlerPerformance;
      }
    }
  };
  var TMapView$1 = isNewEC ? echarts.ComponentView.extend(TMapView) : TMapView;

  var name = "echarts-extension-tmap";
  var version = "1.0.0";

  function install(registers) {
    // add coordinate system support for pie series for ECharts < 5.4.0
    if (!isNewEC || ecVer[0] == 5 && ecVer[1] < 4) {
      registers.registerLayout(function (ecModel) {
        ecModel.eachSeriesByType('pie', function (seriesModel) {
          var coordSys = seriesModel.coordinateSystem;
          var data = seriesModel.getData();
          var valueDim = data.mapDimension('value');
          if (coordSys && coordSys.type === COMPONENT_TYPE) {
            var center = seriesModel.get('center');
            var point = coordSys.dataToPoint(center);
            var cx = point[0];
            var cy = point[1];
            data.each(valueDim, function (value, idx) {
              var layout = data.getItemLayout(idx);
              layout.cx = cx;
              layout.cy = cy;
            });
          }
        });
      });
    }
    // Model
    isNewEC ? registers.registerComponentModel(TMapModel$1) : registers.extendComponentModel(TMapModel$1);
    // View
    isNewEC ? registers.registerComponentView(TMapView$1) : registers.extendComponentView(TMapView$1);
    // Coordinate System
    registers.registerCoordinateSystem(COMPONENT_TYPE, TMapCoordSys);
    // Action
    registers.registerAction({
      type: COMPONENT_TYPE + 'Roam',
      event: COMPONENT_TYPE + 'Roam',
      update: 'updateLayout'
    }, function (payload, ecModel) {
      ecModel.eachComponent(COMPONENT_TYPE, function (tmapModel) {
        var tmap = tmapModel.getTMap();
        var center = tmap.getCenter();
        tmapModel.setCenterAndZoom([center.lng, center.lat], tmap.getZoom());
      });
    });
  }

  /**
   * TODO use `echarts/core` rather than `echarts/lib/echarts`
   * to avoid self-registered `CanvasRenderer` and `DataSetComponent` in Apache ECharts 5
   * but it's not compatible with echarts v4. Leave it to 2.0.
   */
  isNewEC ? echarts.use(install) : install(echarts);

  exports.name = name;
  exports.version = version;

}));
//# sourceMappingURL=echarts-extension-tmap.js.map

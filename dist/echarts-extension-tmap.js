(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('echarts/lib/echarts')) :
  typeof define === 'function' && define.amd ? define(['exports', 'echarts/lib/echarts'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.echarts = global.echarts || {}, global.echarts.amap = {}), global.echarts));
})(this, (function (exports, echarts) { 'use strict';

  const ecVer = echarts.version.split('.');

  const isNewEC = ecVer[0] > 4;

  const COMPONENT_TYPE = 'tmap';

  function v2Equal(a, b) {
    return a && b && a[0] === b[0] && a[1] === b[1]
  }

  let logMap = {};

  function logWarn(tag, msg, once) {
    const log = `[ECharts][Extension][TMap]${tag ? ' ' + tag + ':' : ''} ${msg}`;
    once && logMap[log] || console.warn(log);
    once && (logMap[log] = true);
  }

  function clearLogMap() {
    logMap = {};
  }

  function dataToCoordSize(dataSize, dataItem) {
    dataItem = dataItem || [0, 0];
    return echarts.util.map(
      [0, 1],
      function(dimIdx) {
        const val = dataItem[dimIdx];
        const halfSize = dataSize[dimIdx] / 2;
        const p1 = [];
        const p2 = [];
        p1[dimIdx] = val - halfSize;
        p2[dimIdx] = val + halfSize;
        p1[1 - dimIdx] = p2[1 - dimIdx] = dataItem[1 - dimIdx];
        return Math.abs(
          this.dataToPoint(p1)[dimIdx] - this.dataToPoint(p2)[dimIdx]
        )
      },
      this
    )
  }

  const excludedOptions = [
    'echartsLayerInteractive',
    'renderOnMoving',
    'largeMode',
    'layers'
  ];

  function TMapCoordSys(tmap, api) {
    this._tmap = tmap;
    this._api = api;
    this._mapOffset = [0, 0];
  }

  const TMapCoordSysProto = TMapCoordSys.prototype;

  TMapCoordSysProto.setZoom = function(zoom) {
    this._zoom = zoom;
  };

  TMapCoordSysProto.setCenter = function(center) {
    const lnglat = new T.LngLat(center[0], center[1]);
    this._center = this._tmap.lngLatToContainerPoint(lnglat);
  };

  TMapCoordSysProto.setMapOffset = function(mapOffset) {
    this._mapOffset = mapOffset;
  };

  TMapCoordSysProto.setTMap = function(tmap) {
    this._tmap = tmap;
  };

  TMapCoordSysProto.getTMap = function() {
    return this._tmap
  };

  TMapCoordSysProto.dataToPoint = function(data) {
    const lnglat = new T.LngLat(data[0], data[1]);
    const px = this._tmap.lngLatToContainerPoint(lnglat);
    const mapOffset = this._mapOffset;
    return [px.x - mapOffset[0], px.y - mapOffset[1]]
  };

  TMapCoordSysProto.pointToData = function(pt) {
    const mapOffset = this._mapOffset;
    const lnglat = this._tmap.containerPointToLngLat(
      new T.Point(
        pt[0] + mapOffset[0],
        pt[1] + mapOffset[1]
      )
    );
    return [lnglat.lng, lnglat.lat]
  };

  TMapCoordSysProto.getViewRect = function() {
    const api = this._api;
    return new echarts.graphic.BoundingRect(0, 0, api.getWidth(), api.getHeight())
  };

  TMapCoordSysProto.getRoamTransform = function() {
    return echarts.matrix.create()
  };

  TMapCoordSysProto.prepareCustoms = function() {
    const rect = this.getViewRect();
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
    }
  };

  TMapCoordSysProto.convertToPixel = function(ecModel, finder, value) {
    // here we don't use finder as only one tmap component is allowed
    return this.dataToPoint(value);
  };

  TMapCoordSysProto.convertFromPixel = function(ecModel, finder, value) {
    // here we don't use finder as only one tmap component is allowed
    return this.pointToData(value);
  };

  // less useful
  // TMapCoordSysProto.containPoint = function(point) {
  //   return this._tmap.getBounds().contains(this.pointToData(point));
  // }

  TMapCoordSys.create = function(ecModel, api) {
    let tmapCoordSys;
    ecModel.eachComponent(COMPONENT_TYPE, function(tmapModel) {
      if (typeof T === 'undefined') {
        throw new Error('T api is not loaded')
      }
      if (tmapCoordSys) {
        throw new Error('Only one tmap component is allowed')
      }
      let tmap = tmapModel.getTMap();
      const echartsLayerInteractive = tmapModel.get('echartsLayerInteractive');
      if (!tmap) {
        const root = api.getDom();
        const painter = api.getZr().painter;
        const viewportRoot = painter.getViewportRoot();
        viewportRoot.className = COMPONENT_TYPE + '-ec-layer';
        // PENDING not hidden?
        viewportRoot.style.visibility = 'hidden';
        const className = 'ec-extension-' + COMPONENT_TYPE;
        // Not support IE8
        let tmapRoot = root.querySelector('.' + className);
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

        const options = echarts.util.clone(tmapModel.get());
        // delete excluded options
        echarts.util.each(excludedOptions, function(key) {
          delete options[key];
        });

        tmap = new T.Map(tmapRoot, options);

        const nativeSetMapStyle = tmap.setStyle;
        tmap.setStyle = function () {
          let style = arguments[0];
          logWarn('style', style);
          nativeSetMapStyle.apply(this, arguments);
          tmapModel.__mapStyle = style;
        };

        setTimeout(() => {
          tmapRoot.appendChild(viewportRoot);
          viewportRoot.style.visibility = '';
          viewportRoot.style.zIndex = 1000;
        }, 10 * 2);
        tmapModel.setTMap(tmap);
        tmapModel.setRoot(tmapRoot);
        tmapModel.setEChartsLayer(viewportRoot);

        // Override
        painter.getViewportRootOffset = function() {
          return { offsetLeft: 0, offsetTop: 0 }
        };
      }

      const oldEChartsLayerInteractive = tmapModel.__echartsLayerInteractive;
      if (oldEChartsLayerInteractive !== echartsLayerInteractive) {
        tmapModel.setEChartsLayerInteractive(echartsLayerInteractive);
        tmapModel.__echartsLayerInteractive = echartsLayerInteractive;
      }

      const center = tmapModel.get('center');
      const zoom = tmapModel.get('zoom');
      if (center && zoom) {
        const tmapCenter = tmap.getCenter();
        const tmapZoom = tmap.getZoom();
        const centerOrZoomChanged = tmapModel.centerOrZoomChanged(
          [tmapCenter.lng, tmapCenter.lat],
          tmapZoom
        );
        if (centerOrZoomChanged) {
          tmap.centerAndZoom(new T.LngLat(center[0], center[1]), zoom);
        }
      }

      // update map style(#13)
      const originalMapStyle = tmapModel.__mapStyle;
      const newMapStyle = tmapModel.get('mapStyle');
      if (originalMapStyle !== newMapStyle) {
        tmap.setStyle(tmapModel.__mapStyle = newMapStyle);
      }

      tmapCoordSys = new TMapCoordSys(tmap, api);
      tmapCoordSys.setMapOffset(tmapModel.__mapOffset || [0, 0]);
      tmapCoordSys.setZoom(zoom);
      tmapCoordSys.setCenter(center);

      tmapModel.coordinateSystem = tmapCoordSys;
    });

    ecModel.eachSeries(function(seriesModel) {
      if (seriesModel.get('coordinateSystem') === COMPONENT_TYPE) {
        // inject coordinate system
        seriesModel.coordinateSystem = tmapCoordSys;
      }
    });

    // return created coordinate systems
    return tmapCoordSys && [tmapCoordSys]
  };

  TMapCoordSysProto.dimensions = TMapCoordSys.dimensions = ['lng', 'lat'];

  TMapCoordSysProto.type = COMPONENT_TYPE;

  const TMapModel = {
    type: COMPONENT_TYPE,

    setTMap(tmap) {
      this.__tmap = tmap;
    },

    getTMap() {
      return this.__tmap
    },

    setRoot(root) {
      this.__root = root;
    },

    getRoot(root) {
      return this.__root
    },

    setEChartsLayer(layer) {
      this.__echartsLayer = layer;
    },

    getEChartsLayer() {
      return this.__echartsLayer
    },

    setEChartsLayerVisibility(visible) {
      this.__echartsLayer.style.display = visible ? 'block' : 'none';
    },

    // FIXME: NOT SUPPORT <= IE 10
    setEChartsLayerInteractive(interactive) {
      this.option.echartsLayerInteractive = !!interactive;
      this.__echartsLayer.style.pointerEvents = interactive ? 'auto' : 'none';
    },

    setCenterAndZoom(center, zoom) {
      this.option.center = center;
      this.option.zoom = zoom;
    },

    centerOrZoomChanged(center, zoom) {
      const option = this.option;
      return !(v2Equal(center, option.center) && zoom === option.zoom)
    },

    defaultOption: {
      center: [116.397428, 39.90923],
      zoom: 5,
      resizeEnable: true,
      // extension specific options
      echartsLayerInteractive: true,
      renderOnMoving: false,
      largeMode: false,
    }
  };

  var TMapModel$1 = isNewEC
    ? echarts.ComponentModel.extend(TMapModel)
    : TMapModel;

  const TMapView = {
    type: COMPONENT_TYPE,

    init() {
      this._isFirstRender = true;
    },

    render(tmapModel, ecModel, api) {
      let rendering = true;

      const tmap = tmapModel.getTMap();
      const viewportRoot = api.getZr().painter.getViewportRoot();
      const offsetEl = tmapModel.getRoot();
      const coordSys = tmapModel.coordinateSystem;

      const renderOnMoving = tmapModel.get("renderOnMoving");
      const resizeEnable = tmapModel.get("resizeEnable");
      const largeMode = tmapModel.get("largeMode");

      let moveHandler = function (e) {
        if (rendering) {
          return;
        }

        const offsetElStyle = offsetEl.style;
        const mapOffset = [
          -parseInt(offsetElStyle.left, 10) || 0,
          -parseInt(offsetElStyle.top, 10) || 0,
        ];
        // only update style when map offset changed
        const viewportRootStyle = viewportRoot.style;
        const offsetLeft = mapOffset[0] + "px";
        const offsetTop = mapOffset[1] + "px";
        if (viewportRootStyle.left !== offsetLeft) {
          viewportRootStyle.left = offsetLeft;
        }
        if (viewportRootStyle.top !== offsetTop) {
          viewportRootStyle.top = offsetTop;
        }
        coordSys.setMapOffset((tmapModel.__mapOffset = mapOffset));
        const actionParams = {
          type: "tmapRoam",
          animation: {
            // compatible with ECharts 5.x
            // no delay for rendering but remain animation of elements
            duration: 0,
          },
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
        this._moveStartHandler = () => {
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
      this._moveEndHandler = (e) => {
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
        let resizeHandler = function () {
          echarts.getInstanceByDom(api.getDom()).resize();
        };
        if (largeMode) {
          resizeHandler = echarts.throttle(resizeHandler, 20, true);
        }
        tmap.on("resize", (this._resizeHandler = resizeHandler));
      }

      this._isFirstRender = rendering = false;
    },

    dispose() {
      clearLogMap();
      const component = this.__model;
      if (component) {
        const root = component.getRoot();
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
    },
  };

  var TMapView$1 = isNewEC ? echarts.ComponentView.extend(TMapView) : TMapView;

  var name = "echarts-extension-tmap";
  var version = "1.0.0";

  function install(registers) {
    // add coordinate system support for pie series for ECharts < 5.4.0
    if (!isNewEC || (ecVer[0] == 5 && ecVer[1] < 4)) {
      registers.registerLayout(function(ecModel) {
        ecModel.eachSeriesByType('pie', function (seriesModel) {
          const coordSys = seriesModel.coordinateSystem;
          const data = seriesModel.getData();
          const valueDim = data.mapDimension('value');
          if (coordSys && coordSys.type === COMPONENT_TYPE) {
            const center = seriesModel.get('center');
            const point = coordSys.dataToPoint(center);
            const cx = point[0];
            const cy = point[1];
            data.each(valueDim, function (value, idx) {
              const layout = data.getItemLayout(idx);
              layout.cx = cx;
              layout.cy = cy;
            });
          }
        });
      });
    }
    // Model
    isNewEC
      ? registers.registerComponentModel(TMapModel$1)
      : registers.extendComponentModel(TMapModel$1);
    // View
    isNewEC
      ? registers.registerComponentView(TMapView$1)
      : registers.extendComponentView(TMapView$1);
    // Coordinate System
    registers.registerCoordinateSystem(COMPONENT_TYPE, TMapCoordSys);
    // Action
    registers.registerAction(
      {
        type: COMPONENT_TYPE + 'Roam',
        event: COMPONENT_TYPE + 'Roam',
        update: 'updateLayout'
      },
      function(payload, ecModel) {
        ecModel.eachComponent(COMPONENT_TYPE, function(tmapModel) {
          const tmap = tmapModel.getTMap();
          const center = tmap.getCenter();
          tmapModel.setCenterAndZoom([center.lng, center.lat], tmap.getZoom());
        });
      }
    );
  }

  /**
   * TODO use `echarts/core` rather than `echarts/lib/echarts`
   * to avoid self-registered `CanvasRenderer` and `DataSetComponent` in Apache ECharts 5
   * but it's not compatible with echarts v4. Leave it to 2.0.
   */

  isNewEC ? echarts.use(install) : install(echarts);

  exports.name = name;
  exports.version = version;



  exports.bundleVersion = '1698803841749';

}));

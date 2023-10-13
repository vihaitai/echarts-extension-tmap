import { ComponentView, getInstanceByDom, throttle } from "echarts/lib/echarts";
import { COMPONENT_TYPE, isNewEC, clearLogMap } from "./helper";

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

    if (this.__moveHandlerPerformance) {
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
    this._moveHandler = moveHandler;

    if (!renderOnMoving) {
      tmap.on(
        "movestart",
        (this._moveStartHandler = function () {
          setTimeout(function () {
            tmapModel.setEChartsLayerVisibility(false);
          }, 0);
        })
      );
    } else {
      this._moveHandlerPerformance = throttle(moveHandler, 14, true);
      tmap.on("move", this._moveHandlerPerformance);
    }
    const moveEndHandler = (this._moveEndHandler = function (e) {
      moveHandler(e);
      setTimeout(function () {
        tmapModel.setEChartsLayerVisibility(true);
      }, 20);
    });
    tmap.on("moveend", moveEndHandler);
    tmap.on("zoomend", moveEndHandler);

    if (resizeEnable) {
      let resizeHandler = function () {
        getInstanceByDom(api.getDom()).resize();
      };
      if (largeMode) {
        resizeHandler = throttle(resizeHandler, 20, true);
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
      delete this._moveHandler;
      delete this._resizeHandler;
      delete this._moveStartHandler;
      delete this._moveEndHandler;
      delete this._moveHandlerPerformance;
    }
  },
};

export default isNewEC ? ComponentView.extend(TMapView) : TMapView;

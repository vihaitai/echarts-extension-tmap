import { ComponentModel } from 'echarts/lib/echarts'
import { COMPONENT_TYPE, isNewEC, v2Equal } from './helper'

const TMapModel = {
  type: COMPONENT_TYPE,

  setTMap(tmap) {
    this.__tmap = tmap
  },

  getTMap() {
    return this.__tmap
  },

  setRoot(root) {
    this.__root = root
  },

  getRoot(root) {
    return this.__root
  },

  setEChartsLayer(layer) {
    this.__echartsLayer = layer
  },

  getEChartsLayer() {
    return this.__echartsLayer
  },

  setEChartsLayerVisibility(visible) {
    this.__echartsLayer.style.display = visible ? 'block' : 'none'
  },

  // FIXME: NOT SUPPORT <= IE 10
  setEChartsLayerInteractive(interactive) {
    this.option.echartsLayerInteractive = !!interactive
    this.__echartsLayer.style.pointerEvents = interactive ? 'auto' : 'none'
  },

  setCenterAndZoom(center, zoom) {
    this.option.center = center
    this.option.zoom = zoom
  },

  centerOrZoomChanged(center, zoom) {
    const option = this.option
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
}

export default isNewEC
  ? ComponentModel.extend(TMapModel)
  : TMapModel

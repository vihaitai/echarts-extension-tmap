import { util as zrUtil, graphic, matrix } from 'echarts/lib/echarts'
import { COMPONENT_TYPE, logWarn } from './helper'

function dataToCoordSize(dataSize, dataItem) {
  dataItem = dataItem || [0, 0];
  return zrUtil.map(
    [0, 1],
    function(dimIdx) {
      const val = dataItem[dimIdx]
      const halfSize = dataSize[dimIdx] / 2
      const p1 = []
      const p2 = []
      p1[dimIdx] = val - halfSize
      p2[dimIdx] = val + halfSize
      p1[1 - dimIdx] = p2[1 - dimIdx] = dataItem[1 - dimIdx]
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
]

function TMapCoordSys(tmap, api) {
  this._tmap = tmap
  this._api = api
  this._mapOffset = [0, 0]
}

const TMapCoordSysProto = TMapCoordSys.prototype

TMapCoordSysProto.setZoom = function(zoom) {
  this._zoom = zoom
}

TMapCoordSysProto.setCenter = function(center) {
  const lnglat = new T.LngLat(center[0], center[1])
  this._center = this._tmap.lngLatToContainerPoint(lnglat)
}

TMapCoordSysProto.setMapOffset = function(mapOffset) {
  this._mapOffset = mapOffset
}

TMapCoordSysProto.setTMap = function(tmap) {
  this._tmap = tmap
}

TMapCoordSysProto.getTMap = function() {
  return this._tmap
}

TMapCoordSysProto.dataToPoint = function(data) {
  const lnglat = new T.LngLat(data[0], data[1])
  const px = this._tmap.lngLatToContainerPoint(lnglat)
  const mapOffset = this._mapOffset
  return [px.x - mapOffset[0], px.y - mapOffset[1]]
}

TMapCoordSysProto.pointToData = function(pt) {
  const mapOffset = this._mapOffset
  const lnglat = this._tmap.containerPointToLngLat(
    new T.Point(
      pt[0] + mapOffset[0],
      pt[1] + mapOffset[1]
    )
  )
  return [lnglat.lng, lnglat.lat]
}

TMapCoordSysProto.getViewRect = function() {
  const api = this._api
  return new graphic.BoundingRect(0, 0, api.getWidth(), api.getHeight())
}

TMapCoordSysProto.getRoamTransform = function() {
  return matrix.create()
}

TMapCoordSysProto.prepareCustoms = function() {
  const rect = this.getViewRect()
  return {
    coordSys: {
      type: COMPONENT_TYPE,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    },
    api: {
      coord: zrUtil.bind(this.dataToPoint, this),
      size: zrUtil.bind(dataToCoordSize, this) // TODO: FIXME
    }
  }
}

TMapCoordSysProto.convertToPixel = function(ecModel, finder, value) {
  // here we don't use finder as only one tmap component is allowed
  return this.dataToPoint(value);
}

TMapCoordSysProto.convertFromPixel = function(ecModel, finder, value) {
  // here we don't use finder as only one tmap component is allowed
  return this.pointToData(value);
}

// less useful
// TMapCoordSysProto.containPoint = function(point) {
//   return this._tmap.getBounds().contains(this.pointToData(point));
// }

TMapCoordSys.create = function(ecModel, api) {
  let tmapCoordSys
  ecModel.eachComponent(COMPONENT_TYPE, function(tmapModel) {
    if (typeof T === 'undefined') {
      throw new Error('T api is not loaded')
    }
    if (tmapCoordSys) {
      throw new Error('Only one tmap component is allowed')
    }
    let tmap = tmapModel.getTMap()
    const echartsLayerInteractive = tmapModel.get('echartsLayerInteractive')
    if (!tmap) {
      const root = api.getDom()
      const painter = api.getZr().painter
      const viewportRoot = painter.getViewportRoot()
      viewportRoot.className = COMPONENT_TYPE + '-ec-layer'
      // PENDING not hidden?
      viewportRoot.style.visibility = 'hidden'
      const className = 'ec-extension-' + COMPONENT_TYPE
      // Not support IE8
      let tmapRoot = root.querySelector('.' + className)
      if (tmapRoot) {
        // Reset viewport left and top, which will be changed
        // in moving handler in tmapView
        viewportRoot.style.left = '0px'
        viewportRoot.style.top = '0px'
        root.removeChild(tmapRoot)
      }
      tmapRoot = document.createElement('div')
      tmapRoot.className = className
      tmapRoot.style.cssText = 'position:absolute;top:0;left:0;bottom:0;right:0;'
      root.appendChild(tmapRoot)

      const options = zrUtil.clone(tmapModel.get())
      // delete excluded options
      zrUtil.each(excludedOptions, function(key) {
        delete options[key]
      })

      tmap = new T.Map(tmapRoot, options)

      const nativeSetMapStyle = tmap.setStyle
      tmap.setStyle = function () {
        let style = arguments[0]
        logWarn('style', style)
        nativeSetMapStyle.apply(this, arguments)
        tmapModel.__mapStyle = style
      }

      setTimeout(() => {
        tmapRoot.appendChild(viewportRoot)
        viewportRoot.style.visibility = ''
        viewportRoot.style.zIndex = 1000
      }, 10 * 2)
      tmapModel.setTMap(tmap)
      tmapModel.setRoot(tmapRoot)
      tmapModel.setEChartsLayer(viewportRoot)

      // Override
      painter.getViewportRootOffset = function() {
        return { offsetLeft: 0, offsetTop: 0 }
      }
    }

    const oldEChartsLayerInteractive = tmapModel.__echartsLayerInteractive
    if (oldEChartsLayerInteractive !== echartsLayerInteractive) {
      tmapModel.setEChartsLayerInteractive(echartsLayerInteractive)
      tmapModel.__echartsLayerInteractive = echartsLayerInteractive
    }

    const center = tmapModel.get('center')
    const zoom = tmapModel.get('zoom')
    if (center && zoom) {
      const tmapCenter = tmap.getCenter()
      const tmapZoom = tmap.getZoom()
      const centerOrZoomChanged = tmapModel.centerOrZoomChanged(
        [tmapCenter.lng, tmapCenter.lat],
        tmapZoom
      )
      if (centerOrZoomChanged) {
        tmap.centerAndZoom(new T.LngLat(center[0], center[1]), zoom)
      }
    }

    // update map style(#13)
    const originalMapStyle = tmapModel.__mapStyle
    const newMapStyle = tmapModel.get('mapStyle')
    if (originalMapStyle !== newMapStyle) {
      tmap.setStyle(tmapModel.__mapStyle = newMapStyle)
    }

    tmapCoordSys = new TMapCoordSys(tmap, api)
    tmapCoordSys.setMapOffset(tmapModel.__mapOffset || [0, 0])
    tmapCoordSys.setZoom(zoom)
    tmapCoordSys.setCenter(center)

    tmapModel.coordinateSystem = tmapCoordSys
  })

  ecModel.eachSeries(function(seriesModel) {
    if (seriesModel.get('coordinateSystem') === COMPONENT_TYPE) {
      // inject coordinate system
      seriesModel.coordinateSystem = tmapCoordSys
    }
  })

  // return created coordinate systems
  return tmapCoordSys && [tmapCoordSys]
}

TMapCoordSysProto.dimensions = TMapCoordSys.dimensions = ['lng', 'lat']

TMapCoordSysProto.type = COMPONENT_TYPE


export default TMapCoordSys

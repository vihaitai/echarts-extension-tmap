import TMapCoordSys from './TMapCoordSys'
import TMapModel from './TMapModel'
import TMapView from './TMapView'
import { isNewEC, ecVer, COMPONENT_TYPE } from './helper'

export { version, name } from '../package.json'

export function install(registers) {
  // add coordinate system support for pie series for ECharts < 5.4.0
  if (!isNewEC || (ecVer[0] == 5 && ecVer[1] < 4)) {
    registers.registerLayout(function(ecModel) {
      ecModel.eachSeriesByType('pie', function (seriesModel) {
        const coordSys = seriesModel.coordinateSystem
        const data = seriesModel.getData()
        const valueDim = data.mapDimension('value')
        if (coordSys && coordSys.type === COMPONENT_TYPE) {
          const center = seriesModel.get('center')
          const point = coordSys.dataToPoint(center)
          const cx = point[0]
          const cy = point[1]
          data.each(valueDim, function (value, idx) {
            const layout = data.getItemLayout(idx)
            layout.cx = cx
            layout.cy = cy
          })
        }
      })
    })
  }
  // Model
  isNewEC
    ? registers.registerComponentModel(TMapModel)
    : registers.extendComponentModel(TMapModel)
  // View
  isNewEC
    ? registers.registerComponentView(TMapView)
    : registers.extendComponentView(TMapView)
  // Coordinate System
  registers.registerCoordinateSystem(COMPONENT_TYPE, TMapCoordSys)
  // Action
  registers.registerAction(
    {
      type: COMPONENT_TYPE + 'Roam',
      event: COMPONENT_TYPE + 'Roam',
      update: 'updateLayout'
    },
    function(payload, ecModel) {
      ecModel.eachComponent(COMPONENT_TYPE, function(tmapModel) {
        const tmap = tmapModel.getTMap()
        const center = tmap.getCenter()
        tmapModel.setCenterAndZoom([center.lng, center.lat], tmap.getZoom())
      })
    }
  )
}

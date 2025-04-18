
/// STEP ONE GET SOME SAT DATA 
// SEE SOME THINGS 
// https://developers.google.com/earth-engine/guides/quickstart
// DIRK's awesome code that totally didnt take me 3 hours to figure out ...........................




var startDate = '2020-01-01'
var endDate = '2020-12-31'


// Get the cropland mask from USDA NASS CDL
var getCroplandMask = function(year) {
    // Get the cropland data layer for the specified year
    var cdl = ee.Image('USDA/NASS/CDL/' + year);
    
    // Extract cropland classes (1-255 excluding developed, forest, water, etc.)
    // CDL values 1-60 and some 200+ codes are crop-specific categories
    // We're creating a binary mask where 1 = cropland, 0 = non-cropland
    var croplandClasses = [
      1, 2, 3, 4, 5, 6, 12, 13, 14, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
      31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
      51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 66, 67, 204, 205, 206, 207, 208, 
      209, 210, 211, 212, 213, 214, 216, 219, 220, 221, 222, 223, 224, 225, 
      226, 227, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 
      241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 254
    ];
    
    // Create a binary mask for cropland
    var croplandMask = cdl.select('cropland').remap({
      from: croplandClasses,
      to: ee.List.repeat(1, croplandClasses.length),
      defaultValue: 0
    });
    
    return croplandMask;
};
  
// Get cropland mask for 2023 (using most recent available data)
var croplandMask = getCroplandMask('2023');


//  Stark County,
var roi = ee.FeatureCollection("FAO/GAUL/2015/level2")
  .filter(ee.Filter.eq('ADM1_NAME','Illinois'))
  .filter(ee.Filter.eq('ADM2_NAME','Bureau'))
  
// Map.addLayer(roi,{})

var s2 = ee.ImageCollection("NASA/HLS/HLSS30/v002")
  .filterDate(startDate,endDate)
  .filterBounds(roi)
  .map(function(img){return img.clip(roi)})

var land = ee.ImageCollection("NASA/HLS/HLSL30/v002")
  .filterDate(startDate,endDate)
  .filterBounds(roi)
  .map(function(img){return img.clip(roi)})

// Cloud Masking
function maskHLSFmask(image) {
    var fmask = image.select('Fmask');
    var cloudMask = fmask.bitwiseAnd(1 << 1).eq(0);
    var shadowMask = fmask.bitwiseAnd(1 << 3).eq(0);
    var adjacentMask = fmask.bitwiseAnd(1 << 2).eq(0);
    var snowMask = fmask.bitwiseAnd(1 << 4).eq(0);
    var combinedMask = cloudMask.and(shadowMask).and(adjacentMask).and(snowMask);
    return image.updateMask(combinedMask);
}


// Calculate NDVI
function addNDVISentinel(img) {
    var ndvi = img.normalizedDifference(['B8A', 'B4']).rename('NDVI');
    return img.addBands(ndvi);
    }
    

function addNDVILandsat(img){
    var ndvi = img.normalizedDifference(['B5', 'B4']).rename('NDVI')
    return img.addBands(ndvi)
}


s2 = s2.map(addNDVISentinel).map(maskHLSFmask)
land = land.map(addNDVILandsat).map(maskHLSFmask)

// THE MOST BEST NDVI COLLECTION THERE IS IN BUREAU

var ndviCollection = s2.merge(land)
ndviCollection = ndviCollection.map(function(img){return img.updateMask(croplandMask)})
ndviCollection = ndviCollection.select('NDVI')


// UNCOMMENT TO SEE THE NDVI MAP FOR JULY USING THE QUALITY MOSAIC

// Map.addLayer(ndviCollection.select('NDVI').filterDate('2020-07-01','2020-07-31').qualityMosaic('NDVI'),{'min':-1,'max':1, 'palette':['red','white','green']})


var days = 5
var millis = ee.Number(days).multiply(1000*60*60*24)

var join = ee.Join.saveAll({
  matchesKey:'images'
})

var diffFilter = ee.Filter.maxDifference({
  difference: millis,
  leftField:'system:time_start',
  rightField:'system:time_start'
})

var joinedCollection = join.apply({primary:ndviCollection, secondary:ndviCollection, condition:diffFilter})



var joinedCollection = joinedCollection.map(function(img) {
  return ee.ImageCollection.fromImages(img.get('images')).mean()
    .copyProperties(img,['system:time_start']);
});



// Create a feature collection from your points with labels
var points = ee.FeatureCollection([
  ee.Feature(geometry, {'label': 'Point 1'}),
  ee.Feature(geometry2, {'label': 'Point 2'}),
  ee.Feature(geometry3, {'label': 'Point 3'}),
  // ee.Feature(geometry4, {'label': 'Point 4'})
]);


// / For the optical NDVI data with multiple points
var opticalMultiRegionChart = ui.Chart.image.seriesByRegion({
  imageCollection: ndviCollection,
  regions: points,
  reducer: ee.Reducer.mean(),
  scale: 30,
  xProperty: 'system:time_start',
  seriesProperty: 'label'
})
.setOptions({
  title: 'Optical NDVI Time Series by Point',
  hAxis: {title: 'Date', format: 'MM-yyyy', titleTextStyle: {italic: false, bold: true}},
  vAxis: {title: 'NDVI', titleTextStyle: {italic: false, bold: true}},
  lineWidth: 2,         // Thicker lines to make the connections visible
  pointSize: 3,         // Small points to mark data locations
  connectPoints: true,  // Explicitly connect points
  curveType: 'function', // Use smooth curves between points
  series: {
    'Point 1': {color: 'red'},
    'Point 2': {color: 'blue'},
    'Point 3': {color: 'orange'},    
  }
});

// Display the chart
print("Optical NDVI:", opticalMultiRegionChart);


// / For the optical NDVI data with multiple points
var opticalMultiRegionChart = ui.Chart.image.seriesByRegion({
  imageCollection: joinedCollection,
  regions: points,
  reducer: ee.Reducer.mean(),
  scale: 30,
  xProperty: 'system:time_start',
  seriesProperty: 'label'
})
.setOptions({
  title: 'Optical NDVI Time Series by Point',
  hAxis: {title: 'Date', format: 'MM-yyyy', titleTextStyle: {italic: false, bold: true}},
  vAxis: {title: 'NDVI', titleTextStyle: {italic: false, bold: true}},
  lineWidth: 2,         // Thicker lines to make the connections visible
  pointSize: 3,         // Small points to mark data locations
  connectPoints: true,  // Explicitly connect points
  curveType: 'function', // Use smooth curves between points
  series: {
    'Point 1': {color: 'red'},
    'Point 2': {color: 'blue'},
    'Point 3': {color: 'orange'},    
  }
});

// Display the chart
print("The computationally expensive smoothed NDVI By Point:", opticalMultiRegionChart);

var dataset = ee.ImageCollection('USDA/NASS/CDL')
                  .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
                  .first();
var cropLandcover = dataset.select('cropland');
// Map.setCenter(-100.55, 40.71, 4);
Map.addLayer(cropLandcover, {}, 'Crop Landcover');

// OYSTER MADNESS 

// Inpired by https://cczablan1.users.earthengine.app/view/water-turbidity 
// AND adding Chl

// landsat = ee.ImageCollection("NASA/HLS/HLSL30/v002")


var sent = ee.ImageCollection("NASA/HLS/HLSS30/v002")



// This doesnt work?? 
function waterMasker(img){
  
  var fmask = img.select('Fmask');
  var waterMask = fmask.bitwiseAnd(32).eq(1);
  return img.updateMask(waterMask);
  
}

 // Bit 5 is 32 in decimal



// Define the fmask filters for clouds and Water ! 

// Function to mask clouds and other unwanted pixels using the Fmask bitmask
function maskHLSFmask(image) {
    // Get the Fmask band
    var fmask = image.select('Fmask');
    
    // Extract individual bits using bitwise operations
    // Bit 1: Cloud (0 = no, 1 = yes)
    var cloudMask = fmask.bitwiseAnd(1 << 1).eq(0);
    
    // Bit 3: Cloud shadow (0 = no, 1 = yes)
    var shadowMask = fmask.bitwiseAnd(1 << 3).eq(0);
    
    // Bit 2: Adjacent to cloud/shadow (0 = no, 1 = yes)
    var adjacentMask = fmask.bitwiseAnd(1 << 2).eq(0);
    
    // Bit 4: Snow/ice (0 = no, 1 = yes)
    // var snowMask = fmask.bitwiseAnd(1 << 4).eq(0);
    
    // Combine all masks - keeping only pixels that are:
    // - not clouds
    // - not shadows
    // - not adjacent to clouds/shadows
    // - not snow/ice
    
    // var waterMask = fmask.bitwiseAnd(1 << 5).eq(1) // WATER 
    
    var combinedMask = cloudMask.and(shadowMask).and(adjacentMask);
    
    // Apply the mask to the image
    return image.updateMask(combinedMask);
  }




  // .mosaic();


  
var bandMath = function(img){  
  
  var image = img
  
  var Chl_a = image.expression(
      '4.25 * ((B3/B1)**3.94)', {
        'B1': image.select('B1'),
        'B2':image.select('B2'),
        'B3': image.select('B3'),
        'B4': image.select('B4')
  }).rename('CHL_A');
  
  var Cya = image.expression(
      '115530.31 * (((B3*B4)/B2)**2.38)', {
        'B1': image.select('B1'),
        'B2':image.select('B2'),
        'B3': image.select('B3'),
        'B4': image.select('B4')
  }).rename('CYA');
  
  
  var Turb = image.expression(
      '8.93 * (B3/B1) - 6.39', {
        'B1': image.select('B1'),
        'B2':image.select('B2'),
        'B3': image.select('B3'),
        'B4': image.select('B4')
  }).rename('TUB');
  
  var euler = 2.71828
  
  var CDOM = image.expression(
      '537 * ((-2.93*B3/B4)**2.71828)', {
        'B1': image.select('B1'),
        'B2':image.select('B2'),
        'B3': image.select('B3'),
        'B4': image.select('B4')
  }).rename('CDOM');
  
  var DOC = image.expression(
      '432 * ((-2.24*B3/B4)**2.71828)', {
        'B1': image.select('B1'),
        'B2':image.select('B2'),
        'B3': image.select('B3'),
        'B4': image.select('B4')
  }).rename('DOC');
  
  var Color = image.expression(
      '25366 * ((-4.53*B3/B4)**2.71828)', {
        'B1': image.select('B1'),
        'B2':image.select('B2'),
        'B3': image.select('B3'),
        'B4': image.select('B4')
  }).rename('COLOR');

return ee.Image([Chl_a,Turb,Cya,CDOM,DOC,Color]).copyProperties(img, ["system:time_start"])

}


// test1 = test1.map(waterMasker);

var IC = sent.filterDate('2024-07-15', '2024-09-28')
  .filterBounds(ROI)
  .map(maskHLSFmask) 
  .map(function(img){return img.clip(ROI)})
  .select(['B1','B2','B3','B4'])
  .map(bandMath)


// var chl_a_mask = Chl_a.lte(100)]


print(IC)



// var CHL_A = IC.select('CHL_A').map(threshold_mask)



// 'CYA'
var CYA = IC.select('CYA')
// var CHL_A = IC.select('CHL_A').map(threshold_mask)
var visParamsCYA = {
  
  min:0,
  max:50,
  palette: ['blue','green','yellow','orange','red','brown','purple']
};
var visParamsCHLA = {
  
  min:0,
  max:100,
  palette: ['blue','green','yellow','orange','red','brown','purple']
};
var visParamsTUB = {
  
  min:0,
  max:20,
  palette: ['blue','green','yellow','orange','red','brown','purple']
};


var threshold_mask_CHL_A = function(img){return img.updateMask(img.select('CHL_A').lte(50))}
var threshold_mask_CYA = function(img){return img.updateMask(img.select('CYA').lte(100))}
var threshold_mask_TUB = function(img){return img.updateMask(img.select('TUB').lte(20))}


Map.addLayer(IC.select('CYA').map(threshold_mask_CYA).median(),visParamsCYA, 'CYA' )
Map.addLayer(IC.select('CHL_A').map(threshold_mask_CHL_A).median(),visParamsCHLA , 'CHL_a')
Map.addLayer(IC.select('TUB').map(threshold_mask_TUB).median(),visParamsTUB , 'TUB')


// LOOK AT S3 https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S3_OLCI#bands
// Water Mask -- \Maybe just ham NDWI
// LandSAT add 


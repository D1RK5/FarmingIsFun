
import requests
import re
import xarray as xr
import logging
import numpy as np 

import warnings

warnings.filterwarnings('ignore')
# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)



MODELS = ['gefs_pgrb2ap5_all_00z']




def match_string_with_number(text):
    """Check if string contains a letter followed by a number"""
    pattern = r'[a-zA-Z]+\d+'
    match = re.search(pattern, text)
    return match is not None

def find_largest_number_string(string_list):
    """Find string with largest number in a list"""
    def extract_number(s):
        match = re.match(r'[a-zA-Z]+(\d+)', s)
        return int(match.group(1)) if match else -1
    
    # Find string with max number, filtering out non-matching strings
    valid_strings = [s for s in string_list if extract_number(s) != -1]
    return max(valid_strings, key=extract_number) if valid_strings else None


def get_available_forecasts():
    """Get available GEFS forecast dates"""
    url = 'http://nomads.ncep.noaa.gov:80/dods/gefs/'
    r = requests.get(url)
    
    content = r.text.split('\n')
    datasets = []
    for line in content:
        if 'href' in line:
            txt = line.split('"')[1]
            txt = txt.split('/')[-1]
            if match_string_with_number(txt):
                datasets.append(txt)
    
    return datasets

def get_latest_forecast_url():
    """Get URL for the latest available GEFS forecast"""
    endpoints = get_available_forecasts()
    endpoint = find_largest_number_string(endpoints)
    url = f'http://nomads.ncep.noaa.gov:80/dods/gefs/{endpoint}'
    
    # Check which models are available
    r = requests.get(url)
    content = r.text
    
    available_models = []
    for model in MODELS:
        if model in content:
            logger.info(f"{model} is available")
            available_models.append(model)
        else:
            logger.info(f"{model} is not available")
    
    if not available_models:
        raise ValueError("No GEFS models available")
    
    # Use the latest available model
    selected_model = available_models[-1]
    final_url = f"{url}/{selected_model}"
    
    return final_url, endpoint, selected_model



### Function to calculate degree days

def calculate_gdd(tmin, tmax, tbase, tupper=30):
    """
    Calculate Growing Degree Days (GDD) from temperature data.
    
    Parameters:
    -----------
    tmin : float
        Minimum temperature
    tmax : float
        Maximum temperature
    tbase : float
        Base temperature for the crop
    tupper : float, optional
        Upper temperature threshold, default is 30°C
        
    Returns:
    --------
    float
        The calculated GDD value
    """
    # Apply upper threshold to max temperature if needed
    adjusted_tmax = min(tmax, tupper)
    
    # Apply base threshold to min temperature if needed
    adjusted_tmin = max(tmin, tbase)
    
    # Calculate average temperature
    tavg = (adjusted_tmax + adjusted_tmin) / 2
    
    # Calculate GDD (cannot be negative)
    gdd = max(0, tavg - tbase)
    
    return gdd


def calculate_degree_days(df,tmin, tmax , base_temp=10.0, column='t2m'):
    """
    Calculate Heating, Cooling, and Growing Degree Days
    
    Parameters:
    -----------
    df : pandas DataFrame
        Input dataframe with temperature data
    base_temp : float
        Base temperature in Celsius
    column : str
        Name of temperature column
    
    Returns:
    --------
    DataFrame with HDD, CDD, and GDD columns
    """
    # Convert temperature from Kelvin to Celsius if needed
    if df[column].iloc[0] > 100:  # Simple check if temps are in Kelvin
        temp_celsius = df[column] - 273.15
        flag = -273.15
    else:
        temp_celsius = df[column]
        flag = 0
    
    # Calculate degree days
    df['HDD'] = np.maximum(base_temp - temp_celsius, 0)
    df['CDD'] = np.maximum(temp_celsius - base_temp, 0)
    
    # Calculate GDD with min temp of 10°C and max of 30°C
    df['GDD'] = df.apply(lambda x: calculate_gdd(x[tmin] + flag, x[tmax]+flag, base_temp, tupper=30), axis=1)
    
    return df



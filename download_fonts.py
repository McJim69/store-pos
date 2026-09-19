import urllib.request
import re
import os

url = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})

with urllib.request.urlopen(req) as response:
    css = response.read().decode('utf-8')

os.makedirs('fonts', exist_ok=True)

def replace_url(match):
    font_url = match.group(1)
    font_name = font_url.split('/')[-1]
    
    # Download font
    print(f"Downloading {font_name}...")
    with urllib.request.urlopen(font_url) as f_res:
        with open(f"fonts/{font_name}", 'wb') as f_out:
            f_out.write(f_res.read())
            
    return f"url(fonts/{font_name})"

# Regex to find url(https://...)
new_css = re.sub(r'url\((https://[^)]+)\)', replace_url, css)

with open('fonts.css', 'w') as f:
    f.write(new_css)

print("Done downloading fonts.")

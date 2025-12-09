

import logging
import uuid
import requests
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from ddgs import DDGS
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
CORS(app)  

logging.basicConfig(level=logging.INFO)
app.logger.setLevel(logging.INFO)

SEARCH_STORE = {}

@app.route('/')
def index():
    app.logger.info("Serving index page")
    return render_template('index.html')

@app.route('/api/search', methods=['POST'])
def search():
    try:
        data = request.get_json()
        if not data or 'query' not in data:
            app.logger.error("Invalid request: missing query parameter")
            return jsonify({
                "success": False,
                "error": "Missing 'query' parameter in request body"
            }), 400

        query = data['query'].strip()
        if not query:
            app.logger.error("Empty query provided")
            return jsonify({
                "success": False,
                "error": "Query cannot be empty"
            }), 400

        app.logger.info(f"Searching for: {query}")

        try:
            with DDGS() as ddgs:
                raw_results = list(ddgs.text(query, max_results=10))
                
            app.logger.info(f"Found {len(raw_results)} raw results")
            
        except Exception as search_error:
            app.logger.error(f"DuckDuckGo search failed: {str(search_error)}")
            return jsonify({
                "success": False,
                "error": f"Search service unavailable: {str(search_error)}"
            }), 503
        processed_results = []
        
        for result in raw_results:
            try:
                result_id = uuid.uuid4().hex
                title = result.get('title', 'No Title')
                snippet = result.get('body', result.get('snippet', 'No description available'))
                url = result.get('href', result.get('url', ''))
                
                if not url:
                    continue
                processed_result = {
                    "id": result_id,
                    "title": title,
                    "snippet": snippet,
                    "url": url
                }
                
                SEARCH_STORE[result_id] = {
                    "title": title,
                    "snippet": snippet,
                    "url": url
                }
                
                processed_results.append(processed_result)
                
            except Exception as process_error:
                app.logger.warning(f"Failed to process result: {str(process_error)}")
                continue

        app.logger.info(f"Processed {len(processed_results)} results successfully")
        
        if not processed_results:
            app.logger.info("No results found for query")
            return jsonify({
                "success": True,
                "results": [],
                "message": f"No results found for '{query}'. Try different search terms."
            })
        
        return jsonify({
            "success": True,
            "results": processed_results
        })

    except Exception as e:
        app.logger.error(f"Search endpoint error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Internal server error occurred during search"
        }), 500

@app.route('/api/content/<content_id>', methods=['GET'])
def get_content(content_id):
    try:
        app.logger.info(f"Fetching content for ID: {content_id}")
        
        if content_id not in SEARCH_STORE:
            app.logger.warning(f"Content ID not found: {content_id}")
            return jsonify({
                "success": False,
                "error": "Content not found"
            }), 404

        stored_result = SEARCH_STORE[content_id]
        url = stored_result['url']
        title = stored_result['title']
        fallback_content = stored_result['snippet']
        
        app.logger.info(f"Attempting to fetch full content from: {url}")

        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            
            response = requests.get(url, timeout=6, headers=headers)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            for script in soup(["script", "style", "nav", "header", "footer", "aside"]):
                script.decompose()
            
            extracted_text = ""
            
            main_content = soup.find('main') or soup.find('article')
            
            if main_content:
                extracted_text = main_content.get_text(separator=' ', strip=True)
                app.logger.info("Extracted content from main/article tag")
                
            else:
                paragraphs = soup.find_all('p')
                if paragraphs:
                    paragraph_texts = []
                    for p in paragraphs[:5]:  
                        text = p.get_text(strip=True)
                        if text and len(text) > 20:  
                            paragraph_texts.append(text)
                    
                    extracted_text = ' '.join(paragraph_texts)
                    app.logger.info(f"Extracted content from {len(paragraph_texts)} paragraphs")
                
                else:
                    body = soup.find('body')
                    if body:
                        extracted_text = body.get_text(separator=' ', strip=True)
                        app.logger.info("Extracted content from body tag")

            if extracted_text:
                extracted_text = ' '.join(extracted_text.split())
                
                if len(extracted_text) > 3000:
                    extracted_text = extracted_text[:3000] + "..."
                    app.logger.info("Truncated content to 3000 characters")
                
                content_text = extracted_text
                
            else:
                content_text = fallback_content
                app.logger.info("Using fallback snippet as content")

        except requests.exceptions.Timeout:
            app.logger.warning(f"Timeout fetching content from {url}")
            content_text = fallback_content + " (Note: Full content could not be loaded due to timeout)"
            
        except requests.exceptions.RequestException as req_error:
            app.logger.warning(f"Request failed for {url}: {str(req_error)}")
            content_text = fallback_content + " (Note: Full content could not be loaded)"
            
        except Exception as extract_error:
            app.logger.warning(f"Content extraction failed for {url}: {str(extract_error)}")
            content_text = fallback_content + " (Note: Content extraction failed)"

        return jsonify({
            "success": True,
            "content": {
                "title": title,
                "content": content_text,
                "url": url
            }
        })

    except Exception as e:
        app.logger.error(f"Content endpoint error: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Internal server error occurred while fetching content"
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "success": False,
        "error": "Endpoint not found"
    }), 404

@app.errorhandler(500)
def internal_error(error):
    app.logger.error(f"Internal server error: {str(error)}")
    return jsonify({
        "success": False,
        "error": "Internal server error"
    }), 500

if __name__ == '__main__':
    app.logger.info("Starting VisiFind Flask server...")
    app.logger.info("No API keys required - using free DuckDuckGo search!")
    
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    )
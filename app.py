from flask import Flask, render_template, jsonify, request
import json

app = Flask(__name__)

MOCK_RESULTS = [
    {
        "id": 1,
        "title": "Understanding Voice Search Technology",
        "snippet": "Voice search technology uses speech recognition to convert spoken queries into text, enabling hands-free interaction with digital devices."
    },
    {
        "id": 2,
        "title": "Accessibility in Web Design",
        "snippet": "Web accessibility ensures that websites and applications are usable by people with disabilities, including those who are blind or visually impaired."
    },
    {
        "id": 3,
        "title": "Screen Reader Compatibility Guide",
        "snippet": "Learn how to make your web content compatible with screen readers through proper semantic HTML and ARIA attributes."
    }
]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/search', methods=['POST'])
def search():
    data = request.get_json()
    query = data.get('query', '').lower()
    
    if query:
        filtered_results = [
            result for result in MOCK_RESULTS 
            if query in result['title'].lower() or query in result['snippet'].lower()
        ]
        return jsonify({
            'success': True,
            'results': filtered_results if filtered_results else MOCK_RESULTS,
            'query': query
        })
    
    return jsonify({
        'success': True,
        'results': MOCK_RESULTS,
        'query': query
    })

@app.route('/api/content/<int:result_id>')
def get_content(result_id):
    content = {
        1: {
            "title": "Understanding Voice Search Technology",
            "content": "Voice search technology represents a significant advancement in human-computer interaction. By leveraging sophisticated speech recognition algorithms, these systems can accurately convert spoken language into digital text, enabling users to interact with devices and applications without the need for traditional input methods like keyboards or touchscreens. This technology is particularly valuable for accessibility, allowing individuals with visual impairments or motor disabilities to navigate digital environments more effectively."
        },
        2: {
            "title": "Accessibility in Web Design",
            "content": "Web accessibility is a fundamental principle that ensures digital content is usable by everyone, regardless of their abilities or disabilities. This includes implementing proper semantic HTML structure, providing alternative text for images, ensuring sufficient color contrast, and creating keyboard-navigable interfaces. For users who are blind or visually impaired, these considerations are not just helpful—they are essential for accessing and understanding web content."
        },
        3: {
            "title": "Screen Reader Compatibility Guide",
            "content": "Screen readers are assistive technologies that convert digital text into synthesized speech or braille output. To ensure compatibility, developers must use semantic HTML elements like headings, lists, and landmarks, implement proper ARIA labels and roles, and structure content in a logical, hierarchical manner. Live regions can announce dynamic content changes, while skip links help users navigate efficiently through page sections."
        }
    }
    
    result = content.get(result_id)
    if result:
        return jsonify({
            'success': True,
            'content': result
        })
    
    return jsonify({
        'success': False,
        'error': 'Content not found'
    }), 404

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

import axios from 'axios';

(async () => {
    try {
        console.log('Sending request to generate video...');
        const res = await axios.post('http://localhost:5003/api/v1/generate/video', {
            html: '<html><body><h1>TEST</h1></body></html>',
            duration: 2,
            fps: 30
        });
        console.log('Generate Response:', res.data);
    } catch(e) {
        console.error('Error:', e.response?.data || e.message);
    }
})();

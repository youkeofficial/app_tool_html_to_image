import axios from 'axios';

(async () => {
    try {
        console.log('Sending compose request...');
        const res = await axios.post('http://localhost:5003/api/v1/compose/video-audio', {
            videoFile: 'a5a210c1-ab7b-4fab-9f0f-b2471e200f7b.mp4',
            audioFile: '3fbbe0e5-d760-4c20-8909-4971cb5f5a9d.mp3'
        });
        console.log('Compose Response:', res.data);
    } catch(e: any) {
        console.error('Error:', e.response?.data || e.message);
    }
})();

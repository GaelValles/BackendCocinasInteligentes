import app from './app.js';
import './db.js';

app.listen(process.env.PORT || 3000, () => {
  console.log('Server on port', process.env.PORT || 3000);
});
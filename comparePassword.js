const bcrypt = require('bcrypt');

const hashedPassword = '$2b$10$iZHonYW6S.6vPyDXcB8ga.Wk3rj4/kzjbeO1Q/54vjcyRMnttuYm.'; // Hashed password
const plaintextPassword = 'Admin!'; // Replace with the plaintext password to verify

(async () => {
    const isMatch = await bcrypt.compare(plaintextPassword, hashedPassword);
    if (isMatch) {
        console.log('Password matches!');
    } else {
        console.log('Password does not match.');
    }
})();

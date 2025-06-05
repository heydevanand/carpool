const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const readline = require('readline');

const MONGODB_URI = 'mongodb+srv://heydevanand:engineerdev@dev-cluster.okxr9gy.mongodb.net/pg-carpool?retryWrites=true&w=majority&appName=Dev-Cluster';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(text) {
  return new Promise((resolve) => {
    rl.question(text, resolve);
  });
}

function questionHidden(text) {
  return new Promise((resolve) => {
    process.stdout.write(text);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    let password = '';
    process.stdin.on('data', function(char) {
      char = char + '';
      
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u007f': // backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    });
  });
}

async function createAdmin() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');
    console.log('\n=== Creating Admin User ===\n');

    // Check if any admin already exists
    const existingAdmin = await Admin.findOne();
    if (existingAdmin) {
      console.log('⚠️  An admin user already exists in the database.');
      const overwrite = await question('Do you want to create another admin? (y/N): ');
      if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
        console.log('Admin creation cancelled.');
        process.exit(0);
      }
    }

    // Get admin details
    const username = await question('Enter admin username: ');
    if (!username || username.trim().length < 3) {
      console.log('❌ Username must be at least 3 characters long.');
      process.exit(1);
    }

    const email = await question('Enter admin email: ');
    if (!email || !email.includes('@')) {
      console.log('❌ Please enter a valid email address.');
      process.exit(1);
    }

    const password = await questionHidden('Enter admin password: ');
    if (!password || password.length < 6) {
      console.log('❌ Password must be at least 6 characters long.');
      process.exit(1);
    }

    const confirmPassword = await questionHidden('Confirm admin password: ');
    if (password !== confirmPassword) {
      console.log('❌ Passwords do not match.');
      process.exit(1);
    }

    // Check if username or email already exists
    const existingUser = await Admin.findOne({
      $or: [
        { username: username.toLowerCase().trim() },
        { email: email.toLowerCase().trim() }
      ]
    });

    if (existingUser) {
      console.log('❌ Admin with this username or email already exists.');
      process.exit(1);
    }

    // Create admin
    const admin = new Admin({
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password: password,
      role: 'admin',
      isActive: true
    });

    await admin.save();

    console.log('\n✅ Admin user created successfully!');
    console.log('📧 Email:', admin.email);
    console.log('👤 Username:', admin.username);
    console.log('🔑 Role:', admin.role);
    console.log('\nYou can now login at: /admin/login');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

createAdmin();
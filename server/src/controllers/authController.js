const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Teacher = require('../models/TeacherSide/Teacher');
const Student = require('../models/Student');
const Admin = require('../models/Admin');

exports.login = async (req, res) => {
    try {
        console.log('\n=== LOGIN REQUEST ===');
        const { email, password, role } = req.body;
        
        if (!email || !password || !role) {
            console.log('Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Email, password, and role are required'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const normalizedRole = role.toLowerCase();

        const validRoles = ['teacher', 'student', 'admin'];
        if (!validRoles.includes(normalizedRole)) {
            console.log('Invalid role:', normalizedRole);
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Valid roles: teacher, student, admin'
            });
        }

        let UserModel;
        switch (normalizedRole) {
            case 'teacher': UserModel = Teacher; break;
            case 'student': UserModel = Student; break;
            case 'admin': UserModel = Admin; break;
        }

        console.log(`Searching for ${normalizedRole}: ${normalizedEmail}`);
        const user = await UserModel.findOne({ email: normalizedEmail });
        
        if (!user) {
            console.log(`No ${normalizedRole} found`);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        console.log(`Found user: ${user.name}`);
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            console.log('Password mismatch');
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        console.log('Password verified');
        const token = jwt.sign(
            { id: user._id.toString(), role: normalizedRole },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        console.log('LOGIN SUCCESSFUL');
        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: normalizedRole
            }
        });

    } catch (error) {
        console.error('Login error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during login',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.register = async (req, res) => {
    try {
        console.log('\n=== REGISTRATION REQUEST ===');
        
        const { name, email, password, role, subject, classes, phone, class: studentClass, section, admissionNumber, parentName, parentPhone } = req.body;

        if (!name || !email || !password || !role) {
            console.log('Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: name, email, password, role'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const normalizedRole = role.toLowerCase();
        const normalizedName = name.trim();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            console.log('Invalid email format');
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        if (password.length < 6) {
            console.log('Password too short');
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        const validRoles = ['teacher', 'student', 'admin'];
        if (!validRoles.includes(normalizedRole)) {
            console.log('Invalid role');
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Valid roles: teacher, student, admin'
            });
        }

        console.log('Checking if email exists...');
        const [existingTeacher, existingStudent, existingAdmin] = await Promise.all([
            Teacher.findOne({ email: normalizedEmail }),
            Student.findOne({ email: normalizedEmail }),
            Admin.findOne({ email: normalizedEmail })
        ]);

        if (existingTeacher || existingStudent || existingAdmin) {
            console.log('Email already registered');
            return res.status(409).json({
                success: false,
                message: 'Email already registered'
            });
        }

        console.log('Hashing password...');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let user;

        switch (normalizedRole) {
            case 'teacher':
                user = await Teacher.create({
                    name: normalizedName,
                    email: normalizedEmail,
                    password: hashedPassword,
                    subject: subject || 'General',
                    classes: classes || ['All'],
                    phone: phone || ''
                });
                console.log('Teacher created:', user._id);
                break;

            case 'student':
                if (!studentClass || !section || !admissionNumber) {
                    console.log('Missing student fields');
                    return res.status(400).json({
                        success: false,
                        message: 'Student registration requires: class, section, admissionNumber'
                    });
                }
                user = await Student.create({
                    name: normalizedName,
                    email: normalizedEmail,
                    password: hashedPassword,
                    class: studentClass,
                    section,
                    admissionNumber,
                    parentName: parentName || '',
                    parentPhone: parentPhone || ''
                });
                console.log('Student created:', user._id);
                break;

            case 'admin':
                user = await Admin.create({
                    name: normalizedName,
                    email: normalizedEmail,
                    password: hashedPassword
                });
                console.log('Admin created:', user._id);
                break;
        }

        if (!user) {
            throw new Error('Failed to create user');
        }

        console.log('User saved to database');
        const token = jwt.sign(
            { id: user._id.toString(), role: normalizedRole },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        console.log('REGISTRATION SUCCESSFUL');
        return res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: normalizedRole
            }
        });

    } catch (error) {
        console.error('Registration error:', error.message);
        
        let statusCode = 500;
        let message = 'An error occurred during registration';

        if (error.code === 11000) {
            statusCode = 409;
            message = 'Email already exists';
        } else if (error.name === 'ValidationError') {
            statusCode = 400;
            message = 'Validation error: ' + Object.values(error.errors).map(e => e.message).join(', ');
        } else if (error.name === 'CastError') {
            statusCode = 400;
            message = 'Invalid data format';
        }

        return res.status(statusCode).json({
            success: false,
            message: message,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getCurrentUser = async (req, res) => {
    try {
        const { id, role } = req.user;

        let UserModel;
        switch (role.toLowerCase()) {
            case 'teacher': UserModel = Teacher; break;
            case 'student': UserModel = Student; break;
            case 'admin': UserModel = Admin; break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role'
                });
        }

        const user = await UserModel.findById(id).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.json({
            success: true,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: role
            }
        });
    } catch (error) {
        console.error('Get user error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Error fetching user data',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.createDemoTeacher = async () => {
    try {
        console.log('Creating demo accounts...');
        
        const existingTeacher = await Teacher.findOne({ email: 'teacher@demo.com' });
        if (!existingTeacher) {
            const hashedPassword = await bcrypt.hash('teacher123', 10);
            await Teacher.create({
                name: 'Demo Teacher',
                email: 'teacher@demo.com',
                password: hashedPassword,
                subject: 'Computer Science',
                classes: ['Class A', 'Class B'],
                phone: '9876543210'
            });
            console.log('Created demo teacher: teacher@demo.com');
        }

        const existingAdmin = await Admin.findOne({ email: 'admin@demo.com' });
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await Admin.create({
                name: 'Admin User',
                email: 'admin@demo.com',
                password: hashedPassword
            });
            console.log('Created demo admin: admin@demo.com');
        }
    } catch (error) {
        console.error('Error creating demo accounts:', error.message);
    }
};

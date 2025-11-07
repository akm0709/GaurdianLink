const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// Import models
const Teacher = require('../models/TeacherSide/Teacher');
const Student = require('../models/Student');
const Admin = require('../models/Admin');

/**
 * Login handler
 * Authenticates user and returns JWT token
 */
exports.login = async (req, res) => {
    try {
        console.log('\n=== Login Request ===');
        console.log('Body:', { email: req.body.email, role: req.body.role, hasPassword: !!req.body.password });

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errors.array()
            });
        }

        const { email, password, role } = req.body;

        // Validate required fields
        if (!email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: 'Email, password, and role are required'
            });
        }

        // Determine which model to use based on role
        let UserModel;
        switch (role.toLowerCase()) {
            case 'teacher':
                UserModel = Teacher;
                break;
            case 'student':
                UserModel = Student;
                break;
            case 'admin':
                UserModel = Admin;
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role specified. Valid roles: teacher, student, admin'
                });
        }

        // Find user by email (case-insensitive)
        const user = await UserModel.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, role: role.toLowerCase() },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        console.log(' Login successful for:', user.email);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: role.toLowerCase()
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during login'
        });
    }
};

/**
 * Register handler
 * Creates new user account based on role
 */
exports.register = async (req, res) => {
    try {
        console.log('\n=== Registration Request ===');

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errors.array()
            });
        }

        const { name, email, password, role, subject, classes, phone, class: studentClass, section, admissionNumber, parentName, parentPhone } = req.body;

        // Validate required fields
        if (!name || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Validate role
        const validRoles = ['teacher', 'student', 'admin'];
        const normalizedRole = role.toLowerCase();
        if (!validRoles.includes(normalizedRole)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role specified'
            });
        }

        // Check if user already exists
        const normalizedEmail = email.toLowerCase();
        const [existingTeacher, existingStudent, existingAdmin] = await Promise.all([
            Teacher.findOne({ email: normalizedEmail }),
            Student.findOne({ email: normalizedEmail }),
            Admin.findOne({ email: normalizedEmail })
        ]);

        if (existingTeacher || existingStudent || existingAdmin) {
            return res.status(409).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let user;

        // Create user based on role
        switch (normalizedRole) {
            case 'teacher':
                user = await Teacher.create({
                    name,
                    email: normalizedEmail,
                    password: hashedPassword,
                    subject: subject || 'General',
                    classes: classes || ['All'],
                    phone: phone || ''
                });
                break;

            case 'student':
                if (!studentClass || !section || !admissionNumber) {
                    return res.status(400).json({
                        success: false,
                        message: 'Student registration requires: class, section, admissionNumber'
                    });
                }
                user = await Student.create({
                    name,
                    email: normalizedEmail,
                    password: hashedPassword,
                    class: studentClass,
                    section,
                    admissionNumber,
                    parentName: parentName || '',
                    parentPhone: parentPhone || ''
                });
                break;

            case 'admin':
                user = await Admin.create({
                    name,
                    email: normalizedEmail,
                    password: hashedPassword
                });
                break;
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, role: normalizedRole },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        console.log(' Registration successful for:', user.email);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: normalizedRole
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        let statusCode = 500;
        let message = 'An error occurred during registration';

        if (error.name === 'ValidationError') {
            statusCode = 400;
            message = 'Validation failed';
        } else if (error.code === 11000) {
            statusCode = 409;
            message = 'Email already exists';
        }

        res.status(statusCode).json({
            success: false,
            message: message
        });
    }
};

/**
 * Get current authenticated user
 */
exports.getCurrentUser = async (req, res) => {
    try {
        const { id, role } = req.user;

        let UserModel;
        switch (role.toLowerCase()) {
            case 'teacher':
                UserModel = Teacher;
                break;
            case 'student':
                UserModel = Student;
                break;
            case 'admin':
                UserModel = Admin;
                break;
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

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: role
            }
        });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user data'
        });
    }
};

/**
 * Create demo accounts for testing
 */
exports.createDemoTeacher = async () => {
    try {
        // Check if demo teacher already exists
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
            console.log('✅ Created demo teacher account: teacher@demo.com');
        } else {
            console.log('ℹ️ Demo teacher account already exists');
        }

        // Check if demo admin already exists
        const existingAdmin = await Admin.findOne({ email: 'admin@demo.com' });
        
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await Admin.create({
                name: 'Admin User',
                email: 'admin@demo.com',
                password: hashedPassword,
                permissions: ['manage_students', 'manage_teachers', 'manage_reports']
            });
            console.log('✅ Created demo admin account: admin@demo.com');
        } else {
            console.log('ℹ️ Demo admin account already exists');
        }
    } catch (error) {
        console.error('❌ Error creating demo accounts:', error.message);
    }
};

-- ===========================================================
-- Pronto database setup
-- Run this whole file once in MySQL to create everything
-- the app needs. Safe to re-run: it won't duplicate the DB
-- or tables if they already exist.
-- ===========================================================

CREATE DATABASE IF NOT EXISTS pronto_db;
USE pronto_db;

-- Main tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    intimate_date DATE,
    country VARCHAR(100),
    pronto_no VARCHAR(100) NOT NULL,
    part_code VARCHAR(100),
    unit_name VARCHAR(255),
    part_group VARCHAR(255),
    part_family VARCHAR(255),
    unit_version VARCHAR(100),
    serial_number VARCHAR(100),
    fault_description TEXT,
    owner_type VARCHAR(50),
    owner_name VARCHAR(255),
    created_by VARCHAR(255),
    priority VARCHAR(50) DEFAULT 'No Priority',
    rc_analysis_steps VARCHAR(50) DEFAULT 'Tracking',
    feedback_to_rd TEXT,
    rd_instructions_feedback_to_rc TEXT,
    component_replaced VARCHAR(255),
    final_summary TEXT,
    pronto_rca_analysis_status VARCHAR(50) DEFAULT 'Tracking',
    normal_repair_status VARCHAR(50) DEFAULT 'Visual Check',
    rca_end_date DATE,
    closed_date DATE,
    additional_remarks TEXT,
    status VARCHAR(50) DEFAULT 'Open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Part Code master data
CREATE TABLE IF NOT EXISTS part_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    part_code VARCHAR(100) NOT NULL UNIQUE,
    unit_name VARCHAR(255),
    part_group VARCHAR(255),
    part_family VARCHAR(255)
);

-- R&D Owner master data
CREATE TABLE IF NOT EXISTS rd_owners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255)
);

-- RC Owner master data
CREATE TABLE IF NOT EXISTS rc_owners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255)
);

-- Some starter Part Code rows so the Create Ticket dropdown has real data
INSERT INTO part_codes (part_code, unit_name, part_group, part_family)
VALUES
    ('PC1001', 'Base Station Unit A', 'RF Module', 'Macro Family'),
    ('PC1002', 'Base Station Unit B', 'Power Module', 'Macro Family'),
    ('PC1003', 'Small Cell Unit C', 'Antenna Module', 'Small Cell Family')
ON DUPLICATE KEY UPDATE part_code = part_code;

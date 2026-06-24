# GymPro Management System Setup Guide

This document explains how to set up, run, and connect the Venom Fitness Academy Management System to a fresh Supabase project.

---

## 1. Running the Frontend Locally

To run the app on your local machine for development:

1. **Install Dependencies**
   Ensure you have Node.js installed, then open your terminal in the project directory and run:
   ```bash
   npm install
   ```

2. **Start the Development Server**
   ```bash
   npm run dev
   ```
   This will start the local server, usually accessible at `http://localhost:5000/` (check the terminal output for the exact port).

---

## 2. Migrating to a New Supabase Account

If you want to deploy the backend to a completely new Supabase account/project, follow these exact steps.

### Step 2.1: Create the Project & Update Environment Variables
1. Go to [Supabase](https://supabase.com/) and create a new project.
2. Once the project finishes setting up, go to **Project Settings -> API**.
3. In your local project folder, open the `.env` file and replace the existing variables with your new project's URL and anon key:
   ```env
   VITE_SUPABASE_URL=https://your-new-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-new-anon-key
   ```

### Step 2.2: Disable Email Verification (Important!)
Since we don't want users having to confirm their emails to log in to our internal system:
1. In your Supabase Dashboard, go to **Authentication** -> **Providers**.
2. Click on **Email** to expand it.
3. Toggle **Confirm email** to **OFF** and click Save.

### Step 2.3: Execute the Database Migrations
You must set up the database tables, security policies, triggers, and mock data.
Go to the **SQL Editor** in your Supabase Dashboard, create a new query, and copy/paste/run the contents of the local `supabase/migrations/` files **in this exact order**:

1. **`001_initial_schema.sql`**: Creates all the core tables and the `handle_new_user()` trigger.
2. **`002_rls_policies.sql`**: Secures your database with Row Level Security so only authorized roles can access data.
3. **`003_functions.sql`**: Deploys custom backend Postgres functions (e.g., checking in members).
4. **`004_seed.sql`** (Optional but recommended): Fills your database with test/mock data so your dashboard isn't completely empty.

### Step 2.4: Create Your Admin Account
Because the app does not have a public "Sign Up" page (for security reasons), your first account must be created manually:
1. Go to **Authentication -> Users** in your Supabase Dashboard.
2. Click **Add User -> Create new user**.
3. Enter your email (e.g., `admin@gym.com`) and a password, then click Create.
4. Because you ran `001_initial_schema.sql` first, our database trigger automatically generated a profile row for you.
5. Go to the **Table Editor** -> `profiles` table.
6. Double-click the `role` cell for your new user and type exactly `admin` (all lowercase).

### Step 2.5: Deploy the Edge Functions
To allow the Admin user to create other accounts (like Reception or Sales) from inside the web app, you must deploy our custom Edge Functions.
Open your local terminal and run:

1. Log into the Supabase CLI:
   ```bash
   npx supabase login
   ```
2. Link your local project to your newly created cloud project (find your Project ID in Project Settings -> General -> Reference ID):
   ```bash
   npx supabase link --project-ref your-new-project-id
   ```
3. Deploy the functions:
   ```bash
   npx supabase functions deploy
   ```

---

## 3. You're Done!
Go back to your local server (`http://localhost:5000/`), enter the admin email and password you created, and enjoy managing your gym!

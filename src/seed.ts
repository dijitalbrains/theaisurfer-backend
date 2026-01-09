import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { ProjectsService } from './projects/projects.service';
import * as crypto from 'crypto';

async function seed() {
  console.log('🌱 Starting database seeding...\n');

  const app = await NestFactory.createApplicationContext(AppModule);

  const usersService = app.get(UsersService);
  const projectsService = app.get(ProjectsService);

  try {
    // Create test users
    console.log('Creating test users...');

    let user1, user2, user3;

    try {
      user1 = await usersService.create({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
      });
      console.log('✓ Created user: john.doe@example.com');
    } catch (error) {
      console.log('⚠ User john.doe@example.com already exists');
      user1 = await usersService.findByEmail('john.doe@example.com');
    }

    try {
      user2 = await usersService.create({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        password: 'password123',
      });
      console.log('✓ Created user: jane.smith@example.com');
    } catch (error) {
      console.log('⚠ User jane.smith@example.com already exists');
      user2 = await usersService.findByEmail('jane.smith@example.com');
    }

    try {
      user3 = await usersService.create({
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob.johnson@example.com',
        password: 'password123',
      });
      console.log('✓ Created user: bob.johnson@example.com');
    } catch (error) {
      console.log('⚠ User bob.johnson@example.com already exists');
      user3 = await usersService.findByEmail('bob.johnson@example.com');
    }

    console.log('\nCreating projects...');

    // Helper function to generate API keys
    const generateApiKey = (projectSlug: string): string => {
      const randomBytes = crypto.randomBytes(32).toString('hex');
      return `sk_${projectSlug}_${randomBytes}`;
    };

    // Create projects
    let remixerProject, northstarProject;

    try {
      const remixerApiKey = generateApiKey('remixer');
      remixerProject = await projectsService.create({
        name: 'Remixer',
        slug: 'remixer',
        allowedRedirectUrls: [
          'http://localhost:3001',
          'http://localhost:3001/callback',
          'https://remixer.theaisurfer.com',
          'https://remixer.theaisurfer.com/callback',
        ],
      });
      
      // Update with API key (we need to do this separately as create DTO doesn't include it)
      await projectsService.update('remixer', {
        ...remixerProject,
        apiKey: remixerApiKey,
      } as any);
      
      console.log('✓ Created project: Remixer (remixer)');
      console.log(`  API Key: ${remixerApiKey}`);
    } catch (error) {
      console.log('⚠ Project remixer already exists');
      remixerProject = await projectsService.findBySlug('remixer');
    }

    try {
      const northstarApiKey = generateApiKey('northstar');
      northstarProject = await projectsService.create({
        name: 'Northstar',
        slug: 'northstar',
        allowedRedirectUrls: [
          'http://localhost:3002',
          'http://localhost:3002/callback',
          'https://northstar.theaisurfer.com',
          'https://northstar.theaisurfer.com/callback',
        ],
      });
      
      // Update with API key
      await projectsService.update('northstar', {
        ...northstarProject,
        apiKey: northstarApiKey,
      } as any);
      
      console.log('✓ Created project: Northstar (northstar)');
      console.log(`  API Key: ${northstarApiKey}`);
    } catch (error) {
      console.log('⚠ Project northstar already exists');
      northstarProject = await projectsService.findBySlug('northstar');
    }

    console.log('\n✅ Seeding completed successfully!\n');
    console.log('Test Credentials:');
    console.log('─────────────────────────────────────────');
    console.log('User 1: john.doe@example.com / password123');
    console.log('User 2: jane.smith@example.com / password123');
    console.log('User 3: bob.johnson@example.com / password123');
    console.log('─────────────────────────────────────────');
    console.log('\nNote: All users have access to all projects by default');
    console.log('─────────────────────────────────────────\n');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
  } finally {
    await app.close();
  }
}

seed();

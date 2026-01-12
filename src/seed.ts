import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { ProjectsService } from './projects/projects.service';
import { Project } from './projects/entities/project.entity';
import * as crypto from 'crypto';

async function seed() {
  console.log('🌱 Starting database seeding...\n');

  const app = await NestFactory.createApplicationContext(AppModule);

  const usersService = app.get(UsersService);
  const projectsService = app.get(ProjectsService);

  try {
    // Create test users
    console.log('Creating test users...');

    let user1;
    let user2;
    let user3;

    try {
      user1 = await usersService.create({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
      });
      console.log('✓ Created user: john.doe@example.com');
    } catch {
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
    } catch {
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
    } catch {
      console.log('⚠ User bob.johnson@example.com already exists');
      user3 = await usersService.findByEmail('bob.johnson@example.com');
    }

    // Prevent unused variable warnings
    void user1;
    void user2;
    void user3;

    console.log('\nCreating projects...');

    // Helper function to generate API keys
    const generateApiKey = (projectSlug: string): string => {
      const randomBytes = crypto.randomBytes(32).toString('hex');
      return `sk_${projectSlug}_${randomBytes}`;
    };

    // Create projects
    let remixerProject: Project | null = null;
    let northstarProject: Project | null = null;

    try {
      const remixerApiKey = generateApiKey('remixer');
      remixerProject = await projectsService.create({
        name: 'Remixer',
        slug: 'remixer',
        allowedRedirectUrls: [
          'http://localhost:4041/auth/callback',
          'https://remixer.site/auth/callback',
        ],
      });

      // Update project with API key using a direct repository update
      remixerProject.apiKey = remixerApiKey;
      await projectsService['projectRepository'].save(remixerProject);

      console.log('✓ Created project: Remixer (remixer)');
      console.log(`  API Key: ${remixerApiKey}`);
      console.log('  Allowed Redirect URLs:');
      console.log('    - http://localhost:4041/auth/callback (Development)');
      console.log('    - https://remixer.site/auth/callback (Production)');
    } catch {
      console.log('⚠ Project remixer already exists');
      remixerProject = await projectsService.findBySlug('remixer');
    }

    try {
      const northstarApiKey = generateApiKey('northstar');
      northstarProject = await projectsService.create({
        name: 'Northstar',
        slug: 'northstar',
        allowedRedirectUrls: [
          'http://localhost:4042/auth/callback',
          'https://northstar.site/auth/callback',
        ],
      });

      // Update project with API key using a direct repository update
      northstarProject.apiKey = northstarApiKey;
      await projectsService['projectRepository'].save(northstarProject);

      console.log('✓ Created project: Northstar (northstar)');
      console.log(`  API Key: ${northstarApiKey}`);
      console.log('  Allowed Redirect URLs:');
      console.log('    - http://localhost:4042/auth/callback (Development)');
      console.log('    - https://northstar.site/auth/callback (Production)');
    } catch {
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
    console.log('\nSSO Configuration:');
    console.log('─────────────────────────────────────────');
    console.log('Child apps must use the API key shown above');
    console.log('and ensure their callback URL matches the');
    console.log('allowed redirect URLs for secure SSO flow.');
    console.log('─────────────────────────────────────────');
    console.log('\nNote: All users have access to all projects by default');
    console.log('─────────────────────────────────────────\n');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
  } finally {
    await app.close();
  }
}

void seed();

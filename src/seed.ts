import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ProjectsService } from './projects/projects.service';
import * as crypto from 'crypto';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const projectsService = app.get(ProjectsService);

  try {
    const generateApiKey = (projectSlug: string): string => {
      const randomBytes = crypto.randomBytes(32).toString('hex');
      return `sk_${projectSlug}_${randomBytes}`;
    };

    try {
      const remixerApiKey = generateApiKey('remixer');
      const remixerProject = await projectsService.create({
        name: 'Remixer',
        slug: 'remixer',
        allowedRedirectUrls: [
          'http://localhost:4041/auth/callback',
          'https://remixer.site/auth/callback',
        ],
      });

      remixerProject.apiKey = remixerApiKey;
      await projectsService['projectRepository'].save(remixerProject);

      console.log('✓ Created project: Remixer');
      console.log(`API Key: ${remixerApiKey}`);
    } catch {
      console.log('⚠ Project remixer already exists');
    }

    console.log('\n✅ Seeding completed\n');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
  } finally {
    await app.close();
  }
}

void seed();

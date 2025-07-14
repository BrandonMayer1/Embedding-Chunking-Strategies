import { Controller, Post, Body } from '@nestjs/common';
import { GithubService } from './git.service';

@Controller('docs')
export class GitHubController {
  constructor(private readonly githubService: GithubService) {}

  @Post()
  async handleDocs(@Body() body) {
    const commits = body.commits || [];
    const changedFiles = new Set<string>();

    for (const commit of commits) {
      for (const file of [...commit.added, ...commit.modified]) {
        if (file.startsWith('content/docs/')) {
          changedFiles.add(file);
        }
      }
    }

    console.log('Changed files:' + [...changedFiles]);
    for (const filePath of changedFiles) {
      const content = await this.githubService.getFileFromGitHub(filePath, body.repository.default_branch);
      console.log(`${filePath}:\n`, content);
      this.githubService.handleGithubFiles(content,filePath);
    }

  }
}

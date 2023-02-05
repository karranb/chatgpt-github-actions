# Automated Code Review using the ChatGPT language model

## Import statements
import argparse
import openai
import os
from github import Github
import fnmatch


## Adding command-line arguments
parser = argparse.ArgumentParser()
parser.add_argument('--openai_api_key', help='Your OpenAI API Key')
parser.add_argument('--github_token', help='Your Github Token')
parser.add_argument('--github_pr_id', help='Your Github PR ID')
parser.add_argument('--openai_engine', default="text-davinci-002", help='GPT-3 model to use. Options: text-davinci-002, text-babbage-001, text-curie-001, text-ada-001')
parser.add_argument('--openai_temperature', default=0.5, help='Sampling temperature to use. Higher values means the model will take more risks. Recommended: 0.5')
parser.add_argument('--openai_max_tokens', default=2048, help='The maximum number of tokens to generate in the completion.')
parser.add_argument('--ignore_list', default='', help='The regex of the files that are going to be ignored, separeted by commas')
args = parser.parse_args()

## Authenticating with the OpenAI API
openai.api_key = args.openai_api_key
## Authenticating with the Github API
g = Github(args.github_token)


## Selecting the repository
repo = g.get_repo(os.getenv('GITHUB_REPOSITORY'))


# Select pull request
pull_request = repo.get_pull(int(args.github_pr_id))

# Get PR diff
comparison = repo.compare(pull_request.base.sha, pull_request.head.sha)

# Get latest commit
commit = repo.get_commit(sha=pull_request.head.sha)

ignore = args.ignore_list.split(',')

def check_file_should_be_ignored(file):
    for pattern in ignore:
        if fnmatch.fnmatch(file.filename, pattern):
            return True
    return False

for file in comparison.files:
    # Check file has any adition
    if not file.additions:
        continue
    if check_file_should_be_ignored(file):
        continue
    try:
        # Send openai request
        response = openai.Completion.create(
            engine=args.openai_engine,
            prompt=(f"""
    Act as a code reviewer of a Pull Request, providing feedback on the code changes below.
    You are provided with the Pull Request changes in a patch format.
    Each patch entry has the commit message in the Subject line followed by the code changes (diffs) in a unidiff format.
    Patch of the Pull Request to review:
    {file.patch}
    As a code reviewer, your task is:
    - Give a brief explanation of the code
    - If there are any bugs highlight them
    - If there are multiple issues, enumerate them
    - Do not highlight minor issues, nitpicks and the good parts of the code.
    """),
            temperature=float(args.openai_temperature),
            max_tokens=int(args.openai_max_tokens)
        )
        # Create a review comment in the file
        pull_request.create_review_comment(response['choices'][0]['text'], commit, file.filename, file.changes)
    except Exception as e:
        print('Error:', str(e))




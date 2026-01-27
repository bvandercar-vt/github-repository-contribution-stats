<p align="center">
 <img width="100px" src="https://res.cloudinary.com/anuraghazra/image/upload/v1594908242/logo_ccswme.svg" align="center" alt="GitHub Readme Stats" />
 <h2 align="center">GitHub Repository Contribution Stats</h2>
 <p align="center">Get dynamically generated your github repository contribution stats on your READMEs!</p>
</p>

**ORIGINAL README: https://github.com/HwangTaehyun/github-repository-contribution-stats**

# Features

- [GitHub Repository Contribution Stats Card](#github-repository-contribution-stats-card)
- [Themes](#themes)

# GitHub Repository Contribution Stats Card

Copy and paste this into your markdown content, and that's it. Simple!

My project, which is based on [github-readme-stats](https://github.com/anuraghazra/github-readme-stats), focuses on showing GitHub repository contribution stats and applies the typescript to the original project. Refer to [ISSUE#2027](https://github.com/anuraghazra/github-readme-stats/issues/2027). Thank you [@anuraghazra](https://github.com/anuraghazra) for the awesome open-source project!

After I have applied this, I became enthusiastic about contributing to open source because I can see all my contributions in my Github Readme! If you guys star and let your friends know this, I really appreciate that!

Change the `?username=` value to your GitHub username.

```md
![Taehyun's GitHub Repository Contribution stats](https://github-contributor-stats.vercel.app/api?username=HwangTaehyun)
```

### Demo

![Taehyun's GitHub Repository Contribution stats](https://github-contributor-stats.vercel.app/api?username=HwangTaehyun&hide=B)

_Note: Available ranks are S+ (over 10000), S (over 1000), A+ (over 500), A (over 100), B+ (over 50) and B (over 1)._

### Columns

Can configure the visible columns by passing a string array of values that can be `star_rank`, `contribution_rank`, `commits`, or `pull_requests`

Examples:

- `&columns=contribution_rank`
- `&columns=contribution_rank,star_rank`
- `&columns=star_rank,commits,pull_requests`

<!-- TODO: example image with all columns present -->

### Limiting contribution repos to show

To limit contribution repos to show, you can pass a query parameter `&limit=` with number value. For example, if you want to show only 5 contribution repos, then add **limit=5** like the following one.

```md
![Taehyun's GitHub Repository Contribution stats](https://github-contributor-stats.vercel.app/api?username=HwangTaehyun&limit=5)
```

### Excluding repos to show

To exclude specific repos, you can pass a query parameter `&exclude=` with string-separated repo names. Can use wildcards, i.e. `&exclude=other-username/*`

### Hiding rank stats

To hide specific ranks, you can pass a query parameter `&hide=` with comma-separated rank values. If you need to add plus rank (ex. B+) to hide arrays , it is always safe to replace pluses with %2B

```md
![Taehyun's GitHub Repository Contribution stats](https://github-contributor-stats.vercel.app/api?username=HwangTaehyun&hide=B,B%2B)
```

### Configuring the sorting order for gitHub contributor stats

To specify the sorting order based on either contributions or star count, include the &order_by= query parameter with the options `stars` or `contributions` in your request URL.

```md
![Taehyun's GitHub Repository Contribution stats](https://github-contributor-stats.vercel.app/api?username=HwangTaehyun&hide=B,B%2Bcolumns=contribution_rank,star_rank&limit=5&order_by=contributions)
```

### Including all contributions, not only recent contributions

By default, the card is generated from GitHub's GraphQL API `repositoriesContributedTo`, which only includes recent contributions. To include all contributions, add `&combine_all_yearly_contributions=true` query parameter, which will let the card be generated from GitHub's GraphQL API `contributionsCollection`, including all contributions.

```md
![Taehyun's GitHub Repository Contribution stats](https://github-contributor-stats.vercel.app/api?username=HwangTaehyun&combine_all_yearly_contributions=true)
```

### Themes

With inbuilt themes, you can customize the look of the card without doing any [manual customization](#customization).

Use `&theme=THEME_NAME` parameter like so :-

```md
![Taehyun's GitHub Repository Contribution stats](https://github-contributor-stats.vercel.app/api?username=HwangTaehyun&hide=B&theme=default)
```

#### All inbuilt themes:- in <a href="https://github.com/anuraghazra/github-readme-stats">github-readme-stats' themes</a>

dark, radical, merko, gruvbox, tokyonight, onedark, cobalt, synthwave, highcontrast, dracula

You can look at a preview for [all available themes](./themes/README.md) or checkout the [theme config file](./themes/index.ts) & **you can also contribute new themes** if you like :D

> Note: The minimum of cache_seconds is currently 4 hours as a temporary fix for PATs exhaustion.

## Contribution

Contributions are welcome!

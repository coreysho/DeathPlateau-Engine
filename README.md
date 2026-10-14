<div align="center">
    <h1>Lost City - May 2, 2006</h1>
</div>

> [!NOTE]
> Learn about our history and ethos on our forum: https://lostcity.rs/t/faq-what-is-lost-city/16

Reverse-engineered engine code designed to accurately simulate the cycle behaviors of early RS2. Contains the necessary data tools and compatible network protocol.

Game data is in the [Content](https://github.com/LostCityRS/Content) repository.

The project organizes historical versions into branches. You will need matching engine and content branches together to run the project.

## Getting Started

> [!IMPORTANT]
> If you run into issues, please see our [common issues](#common-issues).

The [Server](https://github.com/LostCityRS/Server) repository will simplify setup for most users. Download that repository and follow the instructions there.

### Manual Setup

In absence of the [Server](https://github.com/LostCityRS/Server) scripts, download the specific engine and content repositories/branches you desire and extract them to the same parent folder.

```sh
git clone https://github.com/LostCityRS/Engine-TS -b 377-wip --single-branch engine
git clone https://github.com/LostCityRS/Content -b 377-wip --single-branch content
cd engine
npm start
```

\* *use `--single-branch` when you don't need to track the commit history of all versions*

Open [http://localhost:8898/setup](http://localhost:8898/setup) to configure world settings.
This page reads and writes `data/config/world.json` through the management server.

### Client

[Client-Java](https://github.com/LostCityRS/Client-Java) is available for all versions. This is a research project to decompile and understand the original code. It has minor fixes for OS and Java compatibility.

[Client-TS](https://github.com/LostCityRS/Client-TS) may be available depending on the version. This is a human-driven port of the original code to modern browsers. This gets prebuilt and included in this repository if available.

You can use the original obfuscated compiled applet from this time period with these arguments: `java -cp runescape.jar client 10 0 highmem members 32`  
Be aware it may have compatibility issues (that are addressed in the Client-Java repository).

## Dependencies

- [Node.js 24+](https://nodejs.org)

> [!TIP]
> If you're using VS Code (recommended), [we have an extension to install on the marketplace.](https://marketplace.visualstudio.com/items?itemName=2004scape.runescriptlanguage)

## Workflow

Content developers should run `npm start`. The server will watch for changes to scripts and configs, then automatically repack everything.

Engine developers should run `npm run dev`. This does what `npm start` does above, but also completely restarts the server when engine code has changed.

## Branches

Upstream organizes historical versions into branches; this fork keeps that and adds one of its own.

- **`377-wip`** - where engine work lands, and what the Content repo's `377-wip` is matched against.
- **`dev-logging`** - what the live server runs. Nothing is committed here directly; merge `377-wip`
  into it with `--no-ff` once a change is ready to go out.

The name is borrowed from the client repo, but it does not behave the same way. There, a push to
`dev-logging` fires `release.yml` and publishes a GitHub Release that every player's launcher picks
up on its own. There is no such workflow here and no launcher fetching an engine build, so a push
to this branch publishes nothing and moves nothing. The server only changes when someone pulls on
the box:

```sh
cd /opt/deathplateau/engine
git fetch origin dev-logging
git checkout dev-logging && git pull
```

That difference is the point of writing it down: merging here is safe at any hour, and is not the
same act as merging `dev-logging` in the client.

## License
This project is licensed under the [MIT License](https://opensource.org/licenses/MIT). See the [LICENSE](LICENSE) file for details.

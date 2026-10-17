# Rebellion Lab | مختبر التمرد

**An open-source, browser-based tactical strategy simulation prototype.**

Rebellion Lab is an experimental turn-based tactical simulation exploring conflict between government forces and rebel factions.

It originated as part of a larger political and military strategy game. This repository contains the isolated Rebellion Lab and its supporting modules, not the complete parent game.

## Live Demo

**[Play Rebellion Lab](https://chatgpt2026chatgpt-eng.github.io/rebellion-lab/rebel-visual-lab.html?version=2)**

The prototype runs directly in a modern web browser. Its interface is currently in Arabic.

## Prototype Features

- Turn-based tactical operations involving government and rebel forces.
- Ground units, armored vehicles, artillery, and tactical orders.
- Cities, mountainous terrain, and battlefield positioning.
- Drones, aircraft, helicopters, and air defense systems.
- Logistics and supply-related mechanics.
- Interactive battlefield and unit controls.

These systems are experimental and remain under development.

## Project Vision

Rebellion Lab is part of a broader vision for a strategy game that connects political decision-making with military consequences.

The long-term goal is to create a simulation where political choices, economic conditions, public stability, and military operations influence one another. A military victory may create political difficulties, while a political decision may change the course of a conflict.

The publicly available Rebellion Lab focuses on experimenting with the tactical and military systems of this larger vision. The complete political simulation is not included in this repository.

## AI-Assisted Development

This project began as an idea that its creator had wanted to realize for years but lacked the programming experience to implement at this scale.

ChatGPT helped turn that idea into a working prototype through technical discussions, code generation, debugging, visual improvements, and iterative development.

As the project grew, the development workflow evolved from manually copying individual code changes to using automated update scripts that apply coordinated changes across multiple project files.

**AI is currently used as a development tool, not as an integrated AI model inside the game.** The existing gameplay systems and automated unit behavior are implemented through conventional program logic.

Rebellion Lab also serves as an opportunity to explore how AI-assisted development can help independent creators build and share technically ambitious interactive projects.

## Run Locally

Requires Node.js 20 or later.

```bash
git clone https://github.com/chatgpt2026chatgpt-eng/rebellion-lab.git
cd rebellion-lab
npm install
npm run dev
```

Open the local URL displayed by Vite.

To build the project:

```bash
npm run build
```

## Project Status

**Experimental prototype — work in progress.**

The current development snapshot is identified as `REBEL-AIRCRAFT-35`.

The project is being developed iteratively, and its mechanics, interface, performance, and balancing may change.

## Open-Source Contributions

Feedback, bug reports, and technical contributions are welcome through GitHub Issues and Pull Requests.

## License

This repository is published under the MIT License. See [LICENSE](LICENSE) for details.

The larger parent strategy game and unpublished proprietary components are not included in this repository.

## Links

- [Live Demo](https://chatgpt2026chatgpt-eng.github.io/rebellion-lab/rebel-visual-lab.html?version=2)
- [Source Code](https://github.com/chatgpt2026chatgpt-eng/rebellion-lab)
- [Report an Issue](https://github.com/chatgpt2026chatgpt-eng/rebellion-lab/issues)

#!/usr/bin/env node
import { Parser, Generators, Filesystem, SiteTree } from "@enkelpanna/core"
import * as fs from "async-file"
import { resolve } from "path"

export class Program {
	private parser = new Parser([])
	private generators = new Generators({})
	readonly version = "0.1.0"
	constructor(private commands: (string | undefined)[]) {
		this.commands = this.commands.slice(2)
	}
	private async load(path: string): Promise<Filesystem.Node | undefined> {
		const status = await fs.stat(path)
		return status.isDirectory ? new Filesystem.Folder(async () => (await Promise.all((await fs.readdir(path)).map(node => ({ name: node, node: this.load(resolve(path, node))})))).reduce<{ [name: string]: Filesystem.Node }>((r, n) => { r[n.name] = n.node; return r }, {})) :
			status.isFile ? new Filesystem.File(() => fs.readFile(path, { encoding: "utf8" }), () => fs.readFile(path, { encoding: "binary" })) :
			undefined
	}
	private async save(path: string, node: Filesystem.Node): Promise<void> {
		if (node instanceof Filesystem.Folder) {
			await fs.createDirectory(path)
			const children = await node.children
			for (const name in children)
				if (children.hasOwnProperty(name))
					this.save(resolve(path, name), children[name])
		} else if (node instanceof (Filesystem.File))
			await fs.writeTextFile(path, await node.textContent, "utf8")
// 		else if (node instanceof (Filesystem.File))
// 			await fs.writeFile(path, await node.binaryContent, "binary")
	}
	private async runHelper(command: string | undefined, commands: (string | undefined)[]) {
		switch (command) {
			default:
				{
					let generator = command ? this.generators.get(command) : undefined
					if (!generator) {
						generator = this.generators
						commands.push(command)
					}
					const content = await this.load(commands.pop() || await fs.realpath(__filename))
					if (content instanceof Filesystem.Folder) {
						const site = new SiteTree.Site(await this.parser.parse(content), { title: "" })
						const result = generator.generate(site)
						await this.save(commands.pop() || await fs.realpath(__filename), result)
					}
				}
				break
			case "version":
				console.log("enkelpanna " + this.version)
				break
			case "help":
				console.log("help")
				break
		}
	}
	run() {
		let command: string | undefined
		while (command = this.commands.shift()) {
			this.runHelper(command, this.commands)
		}
	}
}

const program = new Program(process.argv)
program.run()
console.log("enkelpanna " + program.version)
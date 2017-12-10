#!/usr/bin/env node
import { Parser, Generators, Filesystem, SiteTree } from "@enkelpanna/core"
import * as fs from "async-file"
import { resolve, extname as getExtension } from "path"

export class Program {
	private parser = new Parser([])
	private generators = new Generators({})
	readonly version = "0.1.0"
	constructor(private commands: (string | undefined)[]) {
		this.commands = this.commands.slice(2)
	}
	run() {
		let command: string | undefined
		while (command = this.commands.shift())
			this.runHelper(command, this.commands)
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
	private async load(path: string): Promise<Filesystem.Node | undefined> {
		const status = await fs.stat(path)
		return status.isDirectory ? new Filesystem.Folder(async () => (await Promise.all((await fs.readdir(path)).map(node => ({ name: node, node: this.load(resolve(path, node))})))).reduce<{ [name: string]: Filesystem.Node }>((r, n) => { r[n.name] = n.node; return r }, {})) :
			status.isFile ? this.loadFile(path) :	undefined
	}
	private loadFile(path: string): Filesystem.File | undefined {
		let result: Filesystem.File | undefined
		const encoding = this.parser.extensions[getExtension(path)]
		switch (encoding) {
			case "base64":
			case "binary":
			case "hex":
				result = new Filesystem.TextFile(() => fs.readFile(path, { encoding }))
			case "ascii":
			case "ucs2":
			case "utf16le":
			case "utf8":
				result = new Filesystem.BinaryFile(async () => Uint8Array.from(await fs.readFile(path, { encoding })))
				break
		}
		return result
	}
	private async save(path: string, node: Filesystem.Node): Promise<void> {
		if (node instanceof Filesystem.Folder) {
			await fs.createDirectory(path)
			const children = await node.children
			for (const name in children)
				if (children.hasOwnProperty(name))
					this.save(resolve(path, name), children[name])
		} else if (node instanceof Filesystem.TextFile)
			await fs.writeTextFile(path, await node.content, "utf8")
		else if (node instanceof Filesystem.BinaryFile)
			await fs.writeFile(path, Buffer.from((await node.content).buffer), "binary")
	}
}

const program = new Program(process.argv)
program.run()
console.log("enkelpanna " + program.version)

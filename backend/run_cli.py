import asyncio

from backend.moon_agent_core import create_moon_graph, process_message


async def run_cli():
    graph, client = await create_moon_graph()
    conversation = []

    try:
        print("\nMoon Agent is ready")
        print("Type 'exit' to quit.\n")

        

        while True:
            user_input = input("You: ")

            if user_input.lower() in ["exit", "quit", "q"]:
                print("Goodbye")
                break

            response, conversation = await process_message(
                graph,
                conversation,
                user_input
            )

         
    finally:
        await client.__aexit__(None, None, None)


if __name__ == "__main__":
    asyncio.run(run_cli())
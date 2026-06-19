# ModOne OPC UA 서버에 익명 접속해 브라우징/읽기를 검증하는 테스트 클라이언트
import asyncio
import sys
from asyncua import Client

PORT = sys.argv[1] if len(sys.argv) > 1 else "4840"
URL = f"opc.tcp://127.0.0.1:{PORT}/"


async def main():
    client = Client(url=URL, timeout=5)
    await client.connect()
    print("CONNECTED", URL)
    try:
        root = client.get_root_node()
        objects = client.get_objects_node()
        print("ROOT    :", root)
        print("OBJECTS :", objects)

        children = await objects.get_children()
        print(f"OBJECTS has {len(children)} children:")
        for ch in children:
            name = await ch.read_browse_name()
            print("   -", name.to_string())

        # try to read the server's CurrentTime (standard node) as a liveness/read check
        srv_time = client.get_node("i=2258")  # Server_ServerStatus_CurrentTime
        val = await srv_time.read_value()
        print("ServerTime:", val)
        print("RESULT: PASS")
    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())

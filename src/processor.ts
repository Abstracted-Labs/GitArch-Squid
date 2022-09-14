import { lookupArchive } from "@subsquid/archive-registry";
import * as ss58 from "@subsquid/ss58";
import {
  BatchContext,
  BatchProcessorItem,
  SubstrateBatchProcessor,
  toHex,
} from "@subsquid/substrate-processor";
import { Store, TypeormDatabase } from "@subsquid/typeorm-store";
import { In } from "typeorm";
import {
  Account,
  Ips,
  IpsAccount
} from "./model/generated";
import {
  Inv4IpsCreatedEvent
} from "./types/events";


const processor = new SubstrateBatchProcessor()
  .setBatchSize(500)
  .setDataSource({
    archive: lookupArchive("invarch-tinkernet", { release: "FireSquid" }),
  })
  .setBlockRange({ from: 1 })
  .addEvent("INV4.IPSCreated", {
    data: { event: { args: true , extrinsic: true, call: true} },
  } as const);

type Item = BatchProcessorItem<typeof processor>;
type Ctx = BatchContext<Store, Item>;

processor.run(new TypeormDatabase(), async (ctx) => {
  const events = getEvents(ctx);
  
  // Build map of accountId => Account, only for accountIds that have just been encountered
  let accounts = await ctx.store
    .findBy(Account, { id: In([...events.accountIds]) })
    .then((accounts) => {
      return new Map(accounts.map((a) => [a.id, a]));
    });

    // Don't think I need this block actually
  // for (const ips of events.ips) {
  //   const account = getAccount(accounts, ips[1]);
  //   // necessary to add this field to the previously created model
  //   // because now we have the Account created.
  //   ips[0].accounts.push(account);
  // }

  for (const ipsAccount of events.ipsAccounts)  {
    let id = `${ipsAccount}-${Math.floor(Math.random() * 1_000_000_000_000)}`
    const account = getAccount(accounts, id, ipsAccount[1]);
    // necessary to add this field to the previously created model
    // because now we have the Account created.
    ipsAccount[0].account = account;
  }

  // Save 
  await ctx.store.save(Array.from(accounts.values()));
  await ctx.store.insert(events.ips.map(el => el[0]));
  await ctx.store.insert(events.ipsAccounts.map(el => el[0]));
});

function stringifyArray(list: any[]): any[] {
  let listStr: any[] = [];
  for (let vec of list) {
    for (let i = 0; i < vec.length; i++) {
      vec[i] = String(vec[i]);
    }
    listStr.push(vec);
  }
  return listStr;
}

type Tuple<T,K> = [T,K];
interface EventInfo {
  ips: Tuple<Ips, string>[];
  ipsAccounts: Tuple<IpsAccount, string>[];
  accountIds: Set<string>;
}

function getEvents(ctx: Ctx): EventInfo {
  let events: EventInfo = {
    ips: [],
    ipsAccounts: [],
    accountIds: new Set<string>(),
  };
  for (let block of ctx.blocks) {
    for (let item of block.items) {
      if (item.name === "INV4.IPSCreated") {
        const e = new Inv4IpsCreatedEvent(ctx, item.event);
        // const accountId = ss58.codec("invarch-tinkernet").encode(e.asV2[0]);
        // const accountId = JSON.stringify(item.event.extrinsic?.signature?.address);
        const accountId = item.event.call?.origin?.value.value;
        const { ipsAccount, ipsId, assets } = e.asV2;
        // const alteredIpsAccount = ipsAccount.toString().substring(2);
        const encodedIpsAccount = ss58.codec(117).encode(ipsAccount);

        console.log(`accountId: ${accountId}`);

        ctx.log.debug(`accountId: ${accountId}`);
        ctx.log.debug(`ipsId: ${ipsId.toString()}`);
        ctx.log.debug(`ipsAccount as u8array: ${ipsAccount}`);
        ctx.log.debug(`ipsAccount as string: ${ipsAccount.toString()}`);
        ctx.log.debug(`encodedIpsAccount: ${encodedIpsAccount}`);

        // Create Ips object
        const ipsObj = new Ips({
          id: ipsId.toString(),
          accountId: encodedIpsAccount
        });

        events.ips.push([ipsObj, accountId]);

        let placeholder_acc = new Account({ id: encodedIpsAccount});

        // Create IpsAccount object
        const ipsAccountObj = new IpsAccount({
          id: ipsId.toString() + "-" + encodedIpsAccount,
          account: placeholder_acc, // Setting it here to something. Is updated in processor.run() with correect value
          ips: ipsObj
        });

        events.ipsAccounts.push([ipsAccountObj, accountId]);

        // events.ips.push([new Ips({
        //   id: item.event.id,
        //   fileCid: toHex(e.asV1[1]),
        //   blockHash: block.header.hash,
        //   blockNum: block.header.height,
        //   createdAt: new Date(block.header.timestamp),
        //   extrinsicId: item.event.extrinsic?.id,
        // }), accountId]);

        // add encountered account ID to the Set of unique accountIDs
        events.accountIds.add(accountId);
      }

      // else if (item.name === "INV4.Minted") {
      //   const e = new Inv4MintedEvent(ctx, item.event);

      //   const { token, target, amount} = e.asV2;
      //   const accountId = target.toString();
      //   const ipsId = token.toString();

      //   // Create IpsAccount object
      //   const ipsAccountObj = new IpsAccount({
      //     id: ipsId.toString() + "-" + amount.toString(),
      //     account: new Account(), // Setting it here to something. Is updated in processor.run() with correect value
      //     ips: ipsObj
      //   });

      //   events.ipsAccounts.push([ipsAccountObj, accountId]);

      //   // add encountered account ID to the Set of unique accountIDs
      //   events.accountIds.add(accountId);
      // }
    }
  }
  return events;
}

function getAccount(m: Map<string, Account>, id: string, accountId: string): Account {
  let acc = m.get(id);
  if (acc == null) {
    acc = new Account();
    acc.id = id;
    acc.accountId = accountId;
    m.set(id, acc);
  }
  return acc;
}


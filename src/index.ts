import "reflect-metadata";
import 'dotenv/config';
import { Container } from 'typedi';
import { DatabaseService } from './database/database.service';
import {Server} from "./server/server";

async function init(): Promise<void> {
  const databaseService = Container.get(DatabaseService);
  await databaseService.initializeDatabase();
  console.log('Database initialized');

  Container.get(Server);
}

(async () => {
  await init();
})();

import channelIds from 'config/channelIds';
import { coinDice } from 'config/emojiId';
import { GuildMember, Message, PartialGuildMember, User } from 'discord.js';
import { database } from 'register/firebase';
import { suppressReactionBlocked } from 'util/suppressErrors';
import wait from 'util/wait';
import { getBalance } from './balance';

const spamJoinProtection = new Map<string, number>();
let saidWelcomes: Set<User>[] = [];

export async function toggleOnWelcomeReward(
    member: GuildMember
): Promise<void> {
    if (Date.now() - (spamJoinProtection.get(member.id) || 0) <= 1000 * 60 * 60)
        return;
    const saidWelcome = new Set<User>();
    saidWelcomes.push(saidWelcome);
    await wait(1000 * 60);
    saidWelcomes = saidWelcomes.filter(set => set !== saidWelcome);
}

export async function welcomeRewardSpamProtection(
    member: GuildMember | PartialGuildMember
): Promise<void> {
    spamJoinProtection.set(member.id, Date.now());
}

export default async function welcomeReward(
    message: Message<true>
): Promise<void> {
    const { channel, author, content } = message;
    if (
        !content.toLowerCase().includes('welcome') ||
        channel.id !== channelIds.welcome ||
        !saidWelcomes.length ||
        saidWelcomes.every(set => {
            const saidWelcome = set.has(author);
            set.add(author);
            return saidWelcome;
        })
    )
        return;

    const balance = await getBalance(message, true);
    if (balance === null) return;
    // the first person to welcome gets 250 and then it decreases by 50 until it hits the floor of 100
    const reward = saidWelcomes
        .map(set => Math.max(100, 250 - 50 * (set.size - 1)))
        .reduce((total, current) => total + current, 0);
    await database
        .ref(`discord_bot/community/currency/${author.id}/balance`)
        .set(balance + reward);
    await message.react(coinDice).catch(suppressReactionBlocked);
}

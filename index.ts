import axios from "axios";
import { createPrompt, createSelection } from "bun-promptx";
import chalk from "chalk";
import moment from "moment";
import ora from "ora";

const LOGIN_ENDPOINT = process.env.loginEndpoint;

const AVAILABILITY_ENDPOINT = process.env.availabilityEndpoint;

const TIME_IDS = [
  { duration: "30 minutes", id: 1189 },
  { duration: "60 minutes", id: 1190 },
  { duration: "90 minutes", id: 1191 },
];

const COMPANY_ID = 510481;

const now = moment();

type AuthorizationRequestBody = {
  Pswd: string;
  UserLogin: string;
};

type AuthorizationResponse = {
  CustomerId: number;
  data: {
    token: string;
  };
};

type TimeSlotSelection = {
  Id: number;
  Name: string;
  ResourceTypeId: string;
  IsAssignedResourceSelectable: boolean;
};

type TimeSlotSelections = TimeSlotSelection[];

type AvailabilityTimeSlot = {
  StartDateTime: Date;
  PossibleBookSelections: TimeSlotSelections[];
};

type AvailabilityDay = {
  StartDay: Date;
  AvailableTimes: AvailabilityTimeSlot[];
};

type AvailabilityResponse = {
  ItemDescription: string;
  Duration: string;
  Availability: AvailabilityDay[];
};

const playTimes = (() => {
  const latestHour = 21; // 9pm on weekday (we're not handling weekends / holidays)
  const earliestHour = 5; // 5am on weekdays

  if (now.hour() > latestHour) {
    console.log(chalk.red("There are no court times available this late."));
  }

  if (now.hour() < earliestHour) {
    console.log(chalk.red("There are no courts times available this early"));
  }

  const latest = moment().hour(latestHour);

  const difference = latest.diff(now, "hours");

  /**
   * 1 time slot every 30 minutes
   */
  const numberOfTimeSlotsLeft = difference * 2;

  /**
   * Actual time of time slot. Slots occur every thirty minutes.
   */
  const slots = [...Array(numberOfTimeSlotsLeft)].map((_, index) => {
    const defaultOffset = index + 1; // We do not want to check for a time slot rounding backwards, we only want to check forwards.
    const hoursOffset = Math.floor(defaultOffset / 2); // 0
    const thirtyMinuteSlot = defaultOffset - hoursOffset * 2;

    const time = moment()
      .hour(now.hour() + hoursOffset)
      .minute(thirtyMinuteSlot ? 30 : 0);

    return time;
  });

  /**
   * CLI selections for slots
   */
  const selections = slots.map((time) => {
    return {
      text: moment(time).format("LT"),
    };
  });

  return {
    slots,
    selections,
  };
})();

const login = async (): Promise<AuthorizationResponse | null> => {
  try {
    let password: string = process.env.password || "";
    let username: string = process.env.username || "";

    while (!username) {
      const prompt = createPrompt("Enter username: ");
      username = prompt.value || "";
    }

    while (!password) {
      const prompt = createPrompt("Enter username: ");
      password = prompt.value || "";
    }

    const body: AuthorizationRequestBody = {
      Pswd: password,
      UserLogin: username,
    };

    if (!LOGIN_ENDPOINT) {
      console.log(chalk.red("Please provide a login endpoint to .env"));
      return null;
    }

    const response = await axios.post<AuthorizationResponse>(
      LOGIN_ENDPOINT,
      body,
      {
        headers: {
          "X-Companyid": COMPANY_ID,
        },
      }
    );

    if (response.status !== 200) {
      console.log(chalk.red("Error logging in."));
    }

    return response.data;
  } catch (error) {
    console.log(chalk.red("Failed to login."));
    console.log(chalk.dim(JSON.stringify(error, null, 2)));
    return null;
  }
};

const main = async () => {
  const credentials = await login();

  if (credentials === null) {
    console.log(chalk.red("Credentials not provided from logging in."));
    return;
  }

  const preferredCourt = createSelection(
    [
      { text: "1" },
      { text: "2" },
      { text: "3" },
      { text: "4" },
      { text: "5" },
      { text: "6" },
    ],
    {
      headerText: "Which court do you prefer to play on?",
      footerText: chalk.dim(
        "Another court will automatically be selected if the desired is unavailable."
      ),
      perPage: 6,
    }
  );
  if (preferredCourt.selectedIndex === null) {
    console.log(chalk.red("You must select a court number."));
    return;
  }
  const court = preferredCourt.selectedIndex + 1;

  console.log(
    chalk.yellow(
      "\n\nYou must provide a valid date & time for the current day and business hours.\n\n"
    )
  );

  const whenToPlay = createSelection(playTimes.selections, {
    headerText: "When do you want to play?",
    perPage: 10,
  });
  if (whenToPlay.selectedIndex === null) {
    console.log(chalk.red("You must select a play time."));
    return;
  }

  const timeSlotDuration = createSelection(
    [
      { text: TIME_IDS[0].duration },
      { text: TIME_IDS[1].duration },
      { text: TIME_IDS[2].duration },
    ],
    { headerText: "How long do you want to play for?" }
  );
  if (timeSlotDuration.selectedIndex === null) {
    console.log(chalk.red("Please select a time slot"));
    return;
  }
  const timeSlot = TIME_IDS[timeSlotDuration.selectedIndex];

  const wait = (milliseconds: number) => {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  };

  const selectedTime = playTimes.slots[whenToPlay.selectedIndex];
  const minimumTimePossibleToBook = moment(selectedTime).subtract(1, "hour");

  const currentTime = moment();
  const waitTime = minimumTimePossibleToBook.diff(currentTime);

  console.log(
    `Selected court ${chalk.green(`#${court}`)} at: ${chalk.green(
      selectedTime.format("LT")
    )} for ${chalk.green(timeSlot.duration)}.\n\n`
  );

  const delay = async (milliseconds: number) => {
    if (milliseconds > 0) {
      const spinner = ora(
        `Waiting until ${minimumTimePossibleToBook.format(
          "LT"
        )} to book reservation.\nDo not exit this program or window while it is waiting. You can safely minimize or do something else.`
      ).start();
      await wait(milliseconds);
      spinner.stop();
    }
  };

  await delay(waitTime);

  let availability: AvailabilityDay[] = [];

  try {
    const availabilityRequestBody = {
      ClubId: 55,
      PrimaryCustomerId: credentials.CustomerId,
      AdditionalCustomerIds: [],
      ItemId: TIME_IDS[timeSlotDuration.selectedIndex].id,
      JsonSelectedBook: "null",
      StartDate: now.startOf("month").toDate(),
      EndDate: now.endOf("month").toDate(),
    };

    if (!AVAILABILITY_ENDPOINT) {
      console.log(chalk.red("Please provide an availability endpoint to .env"));
      return;
    }

    const response = await axios.post<AvailabilityResponse>(
      AVAILABILITY_ENDPOINT,
      availabilityRequestBody,
      {
        headers: {
          Authorization: `Bearer ${credentials.data.token}`,
          "X-Companyid": COMPANY_ID,
          "X-Customerid": credentials.CustomerId,
        },
      }
    );

    if (response.status !== 200) {
      console.log(
        chalk.red(
          `Response failed. Status ${response.status}. ${JSON.stringify(
            await response.data,
            null,
            2
          )}`
        )
      );
    }

    availability = response.data.Availability;
  } catch (error) {
    console.log(chalk.red("Error fetching availability."));
  }

  if (!availability.length) {
    console.log(
      chalk.red(
        `There are no courts available at selected time: ${selectedTime.format(
          "LT"
        )}.`
      )
    );
    return;
  }

  availability.forEach(async (day) => {
    const timeSlot = day.AvailableTimes.find((timeSlot) =>
      moment(timeSlot.StartDateTime).isSame(selectedTime, "minute")
    );

    if (
      timeSlot === undefined ||
      timeSlot.PossibleBookSelections.length === 0
    ) {
      console.log(chalk.red("There were no time slots for the selected time."));
      return;
    }

    // Sorts so desired court is attempted first
    const options = timeSlot.PossibleBookSelections.sort((a) =>
      a[0].Name.includes(court.toString()) ? -1 : 1
    );

    const attemptReservation = async (slot: TimeSlotSelection) => {
      // TODO: implement booking reservation
      return true;
    };

    for (let i = 0; i < options.length; i++) {
      const selection = options[i][0];
      const result = await attemptReservation(selection);
      if (result) {
        console.log(chalk.green("Successfully booked reservation."));
        return;
      }
      console.log(
        chalk.yellow(
          `Attempted to book ${selection} but failed. Attempting next court.`
        )
      );
    }
  });
};

await main();
